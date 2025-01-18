import React, { createContext, useContext, useState } from "react";
import { decrypt, encrypt, generateEncryptionKey } from "./crypto";
import { useLocalStorageState } from "./useLocalStorageState";

export interface StoragePayload {
    version: string;
    data: BufferSource | undefined;
}

export interface StorageConfig {
    encryptionKey: string;
    blobConnectionString: string;
    load(name: string): Promise<StoragePayload>;
    save(name: string, data: StoragePayload): Promise<string>;
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
}

const StorageContext = createContext<StorageConfig>({
    encryptionKey: "",
    blobConnectionString: "",
    load: () => Promise.resolve({ data: undefined, version: "" }),
    save: () => Promise.resolve(""),
});

export function useStorage() {
    return useContext(StorageContext);
}

export interface StorageProps {
    app: string;
    ephemeral?: boolean;
    backend(url: string, name: string): AbstractBlobClient;
}

export function Storage({
    app,
    backend,
    children,
    ephemeral,
}: React.PropsWithChildren<StorageProps>) {
    const [key, setKey] = useLocalStorageState(
        `storage-key-${app}`,
        "",
        ephemeral
    );

    const [con, setCon] = useLocalStorageState(
        `storage-con-${app}`,
        "",
        ephemeral
    );
    const [user, setUser] = useLocalStorageState(
        `storage-user-${app}`,
        "",
        ephemeral
    );
    const [editingKey, setEditingKey] = useState(key);
    const [editingCon, setEditingCon] = useState(con);
    const [editingUser, setEditingUser] = useState(user);

    const [showConfig, setShowConfig] = useState(false);

    async function onClickGenerateKey() {
        setKey(await generateEncryptionKey());
    }

    const ctx: StorageConfig = {
        encryptionKey: key,
        blobConnectionString: con,
        async load(name) {
            const fetchedBlob = await backend(
                con,
                `${user}-${name}`
            ).download();
            const version = fetchedBlob.etag!;
            let data: ArrayBuffer | undefined = undefined;
            try {
                const body = await fetchedBlob.blobBody;
                const encrypted = await body!.arrayBuffer();
                data = await decrypt(encrypted, key);
            } catch (x) {}

            return { data, version };
        },
        async save(name, { data, version }) {
            if (!data) return version;

            const encrypted = await encrypt(data, key);
            const conditions = !version
                ? {}
                : {
                      ifMatch: version,
                  };

            const result = await backend(con, `${user}-${name}`).uploadData(
                encrypted,
                {
                    conditions,
                }
            );
            return result.etag!;
        },
    };

    return (
        <div className="app">
            {!key || !con || showConfig ? (
                <div className="storage-options">
                    <form>
                        <h2>
                            <label htmlFor="user-name">User Name</label>
                        </h2>
                        <p>
                            <input
                                name="user-name"
                                id="user-name"
                                value={editingUser}
                                onChange={(e) => setEditingUser(e.target.value)}
                            />
                        </p>
                        <p>
                            <button onClick={() => setUser(editingUser)}>
                                Save
                            </button>
                            <button onClick={() => setEditingUser(user)}>
                                Revert
                            </button>
                        </p>
                        <h2>
                            <label htmlFor="encryption-key">
                                Encryption key
                            </label>
                        </h2>
                        <p>
                            <input
                                name="encryption-key"
                                id="encryption-key"
                                value={editingKey}
                                onChange={(e) => setEditingKey(e.target.value)}
                            />
                        </p>
                        <p>
                            <button onClick={() => setKey(editingKey)}>
                                Save
                            </button>
                            <button onClick={() => setEditingKey(key)}>
                                Revert
                            </button>
                            <button onClick={onClickGenerateKey}>
                                Generate
                            </button>
                        </p>
                        <h2>Blob Connection String</h2>
                        <p>
                            <input
                                name="connection-string"
                                id="connection-string"
                                value={editingCon}
                                onChange={(e) => setEditingCon(e.target.value)}
                            />
                            {editingCon != con && (
                                <>
                                    <button onClick={() => setCon(editingCon)}>
                                        Save
                                    </button>
                                    <button onClick={() => setEditingCon(con)}>
                                        Revert
                                    </button>
                                </>
                            )}
                        </p>
                    </form>
                    <p>
                        <button onClick={() => setShowConfig(false)}>
                            Back
                        </button>
                    </p>
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
