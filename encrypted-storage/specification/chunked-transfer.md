# Chunked Transfer Protocol

The chunked transfer system enables upload and download of large files with progress indication, without loading the entire file into memory at once.

## ✅ Chunk Sizing

```typescript
const CHUNK_SIZE = 1024 * 1024;           // 1MB plaintext
const IV_SIZE = 12;                        // bytes
const AUTH_TAG_SIZE = 16;                  // bytes
const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + IV_SIZE + AUTH_TAG_SIZE;  // ~1MB + 28 bytes
```

Each 1MB plaintext chunk becomes approximately 1MB + 28 bytes when encrypted (12 bytes IV prepended, 16 bytes auth tag appended by AES-GCM).

## ✅ Chunked Upload

### Process

1. **Accept Blob/File**: The `saveChunked()` method accepts a `Blob` or `File` object, not an `ArrayBuffer`. This allows reading chunks on demand without loading the entire file into memory.

2. **Slice and Encrypt**: For each chunk:
   ```typescript
   const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
   const data = await chunk.arrayBuffer();  // Only this chunk in memory
   const encrypted = await encrypt(data, key);
   ```

3. **Stage Blocks**: Each encrypted chunk is uploaded as a "block" with a sequential ID:
   ```typescript
   const blockId = btoa(String(index).padStart(6, "0"));  // "MDAwMDAw", "MDAwMDAx", etc.
   await client.stageBlock(blockId, encrypted);
   ```

4. **Commit Block List**: After all blocks are staged, commit them:
   ```typescript
   await client.commitBlockList(blockIds, { conditions: {} });
   ```

5. **Progress Callback**: After each chunk is uploaded:
   ```typescript
   onProgress?.(uploadedBytes, totalBytes);
   ```

### Memory Efficiency

By accepting a `Blob` and using `slice()`, only one chunk is in memory at a time. The garbage collector can reclaim each chunk's memory before the next is processed.

## ✅ Chunked Download

### Process

1. **Get Properties**: Fetch the blob's total size:
   ```typescript
   const props = await client.getProperties();
   const totalSize = props.contentLength;
   ```

2. **Calculate Chunks**: Determine how many encrypted chunks exist:
   ```typescript
   const chunkCount = Math.ceil(totalSize / ENCRYPTED_CHUNK_SIZE);
   ```

3. **Download and Decrypt**: For each chunk:
   ```typescript
   const offset = i * ENCRYPTED_CHUNK_SIZE;
   const count = Math.min(ENCRYPTED_CHUNK_SIZE, totalSize - offset);
   const encryptedChunk = await client.downloadRange(offset, count);
   const decrypted = await decrypt(encryptedChunk, key);
   ```

4. **Combine Chunks**: Accumulate decrypted chunks in memory:
   ```typescript
   const combined = new Uint8Array(totalDecryptedSize);
   let position = 0;
   for (const chunk of chunks) {
       combined.set(new Uint8Array(chunk), position);
       position += chunk.byteLength;
   }
   ```

5. **Progress Callback**: After each chunk:
   ```typescript
   onProgress?.(downloadedBytes, totalBytes);
   ```

### Note on Memory

For downloads, chunks are accumulated in memory before returning. This provides progress feedback but still requires memory for the full file at the end. For truly large files, the File System Access API could be used to stream directly to disk, but this has limited browser support.

## ✅ Fallback Behavior

If the backend doesn't support chunked operations, the system falls back to simple upload/download:

```typescript
if (!client.stageBlock || !client.commitBlockList) {
    const data = await file.arrayBuffer();
    return ctx.save(name, { data, version: "" });
}
```

This ensures backward compatibility with backends that only support basic operations.

## ✅ Block Blob Architecture (Azure)

The chunked system leverages Azure Block Blob features:

- **Stage Block**: Uploads a block without committing it
- **Commit Block List**: Combines staged blocks into the final blob
- **Range Downloads**: Downloads specific byte ranges from committed blobs

After committing, the blocks become a single blob. Range downloads work on byte offsets within this committed blob, not on individual blocks.

## ✅ Backend Endpoint Requirements

### Azure Backend

Uses native Azure SDK methods:
- `stageBlock(blockId, data, contentLength)`
- `commitBlockList(blockIds, options)`
- `getProperties()`
- `download(offset, count)` for range requests

### Blobshop Backend

Requires these HTTP endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/block/{name}/{blockId}` | PUT | Stage a block |
| `/commit/{name}` | PUT | Commit blocks (JSON body: array of block IDs) |
| `/props/{name}` | HEAD | Get Content-Length and ETag headers |
| `/read/{name}` | GET | Support `Range: bytes=start-end` header |

## ✅ Integration with Encryption

Each chunk is encrypted independently with its own random IV. This means:

1. Chunks can be decrypted in any order
2. Parallel downloads are theoretically possible
3. Corrupted chunks don't affect other chunks
4. The encrypted size is predictable from the plaintext size
