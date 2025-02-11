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
    extra: Record<string, string | undefined>;
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
    extra: {},
    load: () => Promise.resolve({ data: undefined, version: "" }),
    save: () => Promise.resolve(""),
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
    encryptionKey: "Encryption Key",
    blobConnectionString: "Blob Connection String",
    user: "User Name",
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

    const [modifiedSettingValues, setModifiedSettingsValues] = useState<
        Partial<typeof completeSettings>
    >({});

    const savedSettingValues: Partial<typeof completeSettings> = {
        ...JSON.parse(settingValues),
    };

    const { encryptionKey, blobConnectionString, user, ...extra } =
        savedSettingValues;

    const effectiveSettings: Partial<typeof completeSettings> = {
        ...savedSettingValues,
        ...modifiedSettingValues,
    };

    const [showConfig, setShowConfig] = useState(false);

    const ctx: StorageConfig = {
        encryptionKey: encryptionKey ?? "",
        blobConnectionString: blobConnectionString ?? "",
        extra,
        async load(name) {
            const fetchedBlob = await backend(
                blobConnectionString ?? "",
                `${user}-${name}`
            ).download();
            const version = fetchedBlob.etag!;
            let data: ArrayBuffer | undefined = undefined;
            try {
                const body = await fetchedBlob.blobBody;
                const encrypted = await body!.arrayBuffer();
                data = await decrypt(encrypted, encryptionKey ?? "");
            } catch (x) {}

            return { data, version };
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
    };

    return (
        <div className="app">
            {!encryptionKey || !blobConnectionString || !user || showConfig ? (
                <div className="storage-options">
                    <form>
                        <h2>
                            <label htmlFor="user-name">User Name</label>
                        </h2>
                        {keysOf(completeSettings).map((setting) => (
                            <>
                                <p>
                                    <label htmlFor={setting}>
                                        {completeSettings[setting]}
                                    </label>
                                </p>
                                <p>
                                    <input
                                        name={setting}
                                        id={setting}
                                        value={effectiveSettings[setting] ?? ""}
                                        onChange={(e) =>
                                            setModifiedSettingsValues({
                                                ...modifiedSettingValues,
                                                [setting]: e.target.value,
                                            })
                                        }
                                    />
                                </p>
                            </>
                        ))}
                    </form>
                    <p>
                        <button
                            onClick={() => {
                                setSettingValues(
                                    JSON.stringify(effectiveSettings)
                                );
                                setModifiedSettingsValues({});
                            }}
                        >
                            Save
                        </button>
                        <button onClick={() => setModifiedSettingsValues({})}>
                            Revert
                        </button>
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
