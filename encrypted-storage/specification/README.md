# Encrypted Storage System

The encrypted storage system provides a reusable layer for client-side encryption with cloud storage backends. It is designed to be used by multiple applications, each storing their data independently but sharing the same encryption infrastructure.

## Design Constraint: Pure Blob Storage

This system is designed to work with simple blob/object storage services (Azure Blob Storage, S3, or equivalent) that provide only basic operations:

- **Upload** a blob (with optional ETag/If-Match for concurrency)
- **Download** a blob (with optional byte-range requests)
- **Get properties** (size, ETag)
- **Delete** a blob

No custom server-side logic, indexing, or processing is required. All encryption, decryption, chunking, and application logic runs entirely in the client. This constraint ensures the system can be deployed against any commodity blob storage provider without vendor lock-in or custom infrastructure.

## ✅ Encryption

### Algorithm

-   **Cipher**: AES-GCM (Galois/Counter Mode)
-   **Key Length**: 256 bits
-   **IV (Initialization Vector)**: 12 bytes, randomly generated per encryption operation
-   **Authentication Tag**: 16 bytes (built into GCM)

### Key Management

Keys are generated using the Web Crypto API:

```typescript
const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
);
```

Keys are exported as JWK (JSON Web Key) format, base64-encoded, and stored in localStorage as part of the application settings.

### Data Format

Encrypted data is stored as:

```
[12 bytes IV][encrypted ciphertext + 16 byte auth tag]
```

The IV is prepended to the ciphertext so that decryption can extract it and use it with the key.

## ✅ Storage Configuration

The `StorageConfig` interface provides the main API:

```typescript
interface StorageConfig {
    encryptionKey: string;
    blobConnectionString: string;
    extra: Record<string, string | undefined>;

    load(name: string): Promise<StoragePayload>;
    save(name: string, data: StoragePayload): Promise<string>;

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

interface StoragePayload {
    version: string; // ETag for optimistic concurrency
    data: BufferSource | undefined;
}
```

## ✅ Optimistic Concurrency

The system uses ETags for optimistic concurrency control:

1. When loading, the current ETag is returned as `version`
2. When saving, the `version` is passed as an `If-Match` header
3. If the blob was modified since loading, the save fails with a 412 (Precondition Failed)
4. On conflict, the system reloads the latest version, replays queued actions, and retries

## ✅ Genesis Case (New Blob Creation)

When a blob doesn't exist yet:

1. The `load()` function returns `{ data: undefined, version: "" }`
2. An empty string version signals "create new" rather than "update existing"
3. The `save()` function omits the `If-Match` header when version is empty
4. This allows unconditional creation of the blob

**Important**: The version must be initialized to an empty string `""` (falsy) rather than a placeholder like `"none"` (truthy), so that the conditional logic `!version ? {} : { ifMatch: version }` works correctly.

## ✅ Storage Backends

### AbstractBlobClient Interface

```typescript
interface AbstractBlobClient {
    download(): Promise<{
        etag?: string;
        blobBody?: Promise<Blob>;
    }>;

    uploadData(
        data: BufferSource,
        options: { conditions: { ifMatch?: string } }
    ): Promise<{ etag?: string }>;

    // Optional methods for chunked operations
    stageBlock?(blockId: string, data: BufferSource): Promise<void>;
    commitBlockList?(
        blockIds: string[],
        options: { conditions: { ifMatch?: string } }
    ): Promise<{ etag?: string }>;
    getProperties?(): Promise<{ contentLength: number; etag?: string }>;
    downloadRange?(offset: number, count: number): Promise<ArrayBuffer>;
}
```

### Azure Blob Storage Backend

Uses the `@azure/storage-blob` SDK. Blob names are prefixed with user ID: `{user}-{name}`.

### Blobshop Backend

A custom HTTP backend with endpoints:

-   `GET /read/{name}` - Download blob (supports Range header)
-   `PUT /write/{name}` - Upload blob (supports If-Match header)
-   `PUT /block/{name}/{blockId}` - Stage a block
-   `PUT /commit/{name}` - Commit block list
-   `HEAD /props/{name}` - Get blob properties

## ✅ React Integration

The `Storage` component provides a React context:

```tsx
<Storage settings={{}} backend={azureBackend} app="vault">
    <App />
</Storage>
```

Applications use the `useStorage()` hook to access the `StorageConfig`.

## ✅ Settings UI

The Storage component includes a settings UI that:

1. Prompts for a "password" (actually a JSON object with settings)
2. Extracts `key` (encryption key), `con` (connection string), and `uid` (user ID)
3. Stores settings in localStorage
4. Shows a "Show storage options" link when configured

## ✅ Action Queue (Offline Support)

The `useStorageBackedState` hook implements an action queue:

1. User actions are immediately applied to local state
2. Actions are queued in localStorage
3. After a 2-second debounce, the state is saved
4. On save failure, the latest state is reloaded and queued actions are replayed
5. Successfully saved actions are removed from the queue

This ensures no user actions are lost during connectivity issues.

## ✅ Chunked Transfer Support

-   [Chunked Transfer Protocol](./chunked-transfer.md) - Large file support with 1MB encrypted chunks and progress tracking
