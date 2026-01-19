import React, { createContext, useContext, useState } from "react";
import {
    decrypt,
    encrypt,
    CHUNK_SIZE,
    ENCRYPTED_CHUNK_SIZE,
} from "./crypto";
import { useLocalStorageState } from "./useLocalStorageState";

export interface StoragePayload {
    version: string;
    data: BufferSource | undefined;
}

export interface StorageConfig {
    encryptionKey: string;
    blobConnectionString: string;
    extra: Record<string, string | undefined>;
    load(name: string): Promise<StoragePayload>;
    save(name: string, data: StoragePayload): Promise<string>;
    delete(name: string): Promise<void>;

    // Optional chunked methods for large files
    saveChunked?(
        name: string,
        file: Blob,
        onProgress?: (uploaded: number, total: number) => void
    ): Promise<string>;
    loadChunked?(
        name: string,
        onProgress?: (downloaded: number, total: number) => void
    ): Promise<StoragePayload>;
}

export interface AbstractBlobClient {
    download(): Promise<{
        etag?: string;
        blobBody?: Promise<Blob>;
    }>;
    uploadData(
        data: BufferSource,
        options: {
            conditions: {
                ifMatch?: string;
            };
        }
    ): Promise<{
        etag?: string;
    }>;
    delete(): Promise<void>;

    // Optional methods for chunked upload/download
    stageBlock?(blockId: string, data: BufferSource): Promise<void>;
    commitBlockList?(
        blockIds: string[],
        options: { conditions: { ifMatch?: string } }
    ): Promise<{ etag?: string }>;
    getProperties?(): Promise<{ contentLength: number; etag?: string }>;
    downloadRange?(offset: number, count: number): Promise<ArrayBuffer>;
}

const StorageContext = createContext<StorageConfig>({
    encryptionKey: "",
    blobConnectionString: "",
    extra: {},
    load: () => Promise.resolve({ data: undefined, version: "" }),
    save: () => Promise.resolve(""),
    delete: () => Promise.resolve(),
});

export function useStorage() {
    return useContext(StorageContext);
}

export interface StorageProps<P extends string> {
    app: string;
    ephemeral?: boolean;
    backend(url: string, name: string): AbstractBlobClient;
    settings: Record<P, string>;
}

const coreSettings = {
    encryptionKey: "key",
    blobConnectionString: "con",
    user: "uid",
};

function keysOf<T extends object>(obj: T) {
    return Object.keys(obj) as (keyof T)[];
}

export function Storage<P extends string>({
    app,
    backend,
    children,
    ephemeral,
    settings,
}: React.PropsWithChildren<StorageProps<P>>) {
    const completeSettings = { ...settings, ...coreSettings };

    const [settingValues, setSettingValues] = useLocalStorageState(
        "storage-settings",
        "{}",
        ephemeral
    );

    const savedSettingValues: Partial<typeof completeSettings> = {
        ...JSON.parse(settingValues),
    };

    const { encryptionKey, blobConnectionString, user, ...extra } =
        savedSettingValues;

    const [showConfig, setShowConfig] = useState(false);

    const ctx: StorageConfig = {
        encryptionKey: encryptionKey ?? "",
        blobConnectionString: blobConnectionString ?? "",
        extra,
        async load(name) {
            try {
                const fetchedBlob = await backend(
                    blobConnectionString ?? "",
                    `${user}-${name}`
                ).download();

                // Blob doesn't exist (blobshop returns undefined etag)
                if (!fetchedBlob.etag) {
                    return { data: undefined, version: "" };
                }

                const version = fetchedBlob.etag;
                let data: ArrayBuffer | undefined = undefined;
                try {
                    const body = await fetchedBlob.blobBody;
                    const encrypted = await body!.arrayBuffer();
                    data = await decrypt(encrypted, encryptionKey ?? "");
                } catch (x) {}

                return { data, version };
            } catch (x) {
                // Blob doesn't exist (Azure throws 404)
                return { data: undefined, version: "" };
            }
        },
        async save(name, { data, version }) {
            if (!data) return version;

            const encrypted = await encrypt(data, encryptionKey ?? "");
            const conditions = !version
                ? {}
                : {
                      ifMatch: version,
                  };

            const result = await backend(
                blobConnectionString ?? "",
                `${user}-${name}`
            ).uploadData(encrypted, {
                conditions,
            });
            return result.etag!;
        },

        async delete(name) {
            await backend(blobConnectionString ?? "", `${user}-${name}`).delete();
        },

        async saveChunked(name, file, onProgress) {
            const client = backend(blobConnectionString ?? "", `${user}-${name}`);

            if (!client.stageBlock || !client.commitBlockList) {
                // Fallback to regular save if chunked not supported
                const data = await file.arrayBuffer();
                return ctx.save(name, { data, version: "" });
            }

            const blockIds: string[] = [];
            let uploaded = 0;

            for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
                const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
                const data = await chunk.arrayBuffer();
                const encrypted = await encrypt(data, encryptionKey ?? "");

                const blockId = btoa(String(blockIds.length).padStart(6, "0"));
                blockIds.push(blockId);

                await client.stageBlock(blockId, encrypted);

                uploaded += chunk.size;
                onProgress?.(uploaded, file.size);
            }

            const result = await client.commitBlockList(blockIds, { conditions: {} });
            return result.etag!;
        },

        async loadChunked(name, onProgress) {
            const client = backend(blobConnectionString ?? "", `${user}-${name}`);

            if (!client.getProperties || !client.downloadRange) {
                // Fallback to regular load if chunked not supported
                return ctx.load(name);
            }

            try {
                const props = await client.getProperties();
                if (!props.contentLength) {
                    return { data: undefined, version: "" };
                }

                const totalSize = props.contentLength;
                const chunkCount = Math.ceil(totalSize / ENCRYPTED_CHUNK_SIZE);
                const chunks: ArrayBuffer[] = [];
                let downloaded = 0;

                for (let i = 0; i < chunkCount; i++) {
                    const offset = i * ENCRYPTED_CHUNK_SIZE;
                    const count = Math.min(ENCRYPTED_CHUNK_SIZE, totalSize - offset);

                    const encryptedChunk = await client.downloadRange(offset, count);
                    const decrypted = await decrypt(encryptedChunk, encryptionKey ?? "");
                    chunks.push(decrypted);

                    downloaded += count;
                    onProgress?.(downloaded, totalSize);
                }

                // Combine all decrypted chunks
                const totalDecryptedSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
                const combined = new Uint8Array(totalDecryptedSize);
                let position = 0;
                for (const chunk of chunks) {
                    combined.set(new Uint8Array(chunk), position);
                    position += chunk.byteLength;
                }

                return { data: combined.buffer, version: props.etag ?? "" };
            } catch (x) {
                return { data: undefined, version: "" };
            }
        },
    };

    const [password, setPassword] = useState("");

    const ready = !!encryptionKey && !!blobConnectionString && !!user;

    return (
        <div className="app">
            {!ready || showConfig ? (
                <div className="storage-options">
                    <form action="#">
                        <p>
                            <label htmlFor="password">Password</label>
                        </p>
                        <p>
                            <input
                                name="password"
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </p>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                const parsed = JSON.parse(password);

                                const formatted = Object.fromEntries(
                                    Object.entries(completeSettings).map(
                                        ([longKey, shortKey]) => [
                                            longKey,
                                            parsed[shortKey] ?? "",
                                        ]
                                    )
                                );

                                setSettingValues(JSON.stringify(formatted));
                            }}
                        >
                            Go
                        </button>
                        {ready && (
                            <button onClick={() => setShowConfig(false)}>
                                Back
                            </button>
                        )}
                    </form>
                </div>
            ) : (
                <>
                    <div className="storage-options-bar">
                        <span
                            className="storage-options-link"
                            onClick={() => setShowConfig(true)}
                        >
                            Show storage options
                        </span>
                    </div>
                    <div className="app-content">
                        <StorageContext.Provider value={ctx}>
                            {children}
                        </StorageContext.Provider>
                    </div>
                </>
            )}
        </div>
    );
}
