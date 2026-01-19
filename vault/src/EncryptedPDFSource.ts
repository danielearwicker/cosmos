import { decrypt, CHUNK_SIZE, ENCRYPTED_CHUNK_SIZE } from "../../encrypted-storage/crypto";
import type { AbstractBlobClient } from "../../encrypted-storage/Storage";

/**
 * Provides a PDF.js-compatible data source that reads from encrypted chunked storage.
 * Decrypted chunks are cached to avoid re-fetching and re-decrypting.
 */
export class EncryptedPDFSource {
    private chunkCache: Map<number, ArrayBuffer> = new Map();
    private totalSize: number = 0;
    private totalChunks: number = 0;
    private encryptedSize: number = 0;

    constructor(
        private client: AbstractBlobClient,
        private encryptionKey: string,
        private onProgress?: (loaded: number, total: number) => void
    ) {}

    async initialize(): Promise<number> {
        if (!this.client.getProperties) {
            throw new Error("Client does not support getProperties");
        }

        const props = await this.client.getProperties();
        this.encryptedSize = props.contentLength;
        this.totalChunks = Math.ceil(this.encryptedSize / ENCRYPTED_CHUNK_SIZE);

        // Calculate decrypted size (approximate - last chunk may be smaller)
        // Each chunk loses IV_SIZE + AUTH_TAG_SIZE bytes when decrypted
        const fullChunks = Math.floor(this.encryptedSize / ENCRYPTED_CHUNK_SIZE);
        const lastChunkEncrypted = this.encryptedSize % ENCRYPTED_CHUNK_SIZE;

        this.totalSize = fullChunks * CHUNK_SIZE;
        if (lastChunkEncrypted > 28) {
            // 28 = IV_SIZE + AUTH_TAG_SIZE
            this.totalSize += lastChunkEncrypted - 28;
        }

        return this.totalSize;
    }

    get length(): number {
        return this.totalSize;
    }

    private async getChunk(chunkIndex: number): Promise<ArrayBuffer> {
        if (this.chunkCache.has(chunkIndex)) {
            return this.chunkCache.get(chunkIndex)!;
        }

        if (!this.client.downloadRange) {
            throw new Error("Client does not support downloadRange");
        }

        const offset = chunkIndex * ENCRYPTED_CHUNK_SIZE;
        const count = Math.min(
            ENCRYPTED_CHUNK_SIZE,
            this.encryptedSize - offset
        );

        const encrypted = await this.client.downloadRange(offset, count);
        const decrypted = await decrypt(encrypted, this.encryptionKey);

        this.chunkCache.set(chunkIndex, decrypted);

        // Report progress based on cached chunks
        if (this.onProgress) {
            const loadedChunks = this.chunkCache.size;
            this.onProgress(loadedChunks, this.totalChunks);
        }

        return decrypted;
    }

    /**
     * Read a range of bytes from the decrypted content.
     * This is the main method used by PDF.js to fetch data.
     */
    async read(offset: number, length: number): Promise<Uint8Array> {
        const result = new Uint8Array(length);
        let resultOffset = 0;
        let remaining = length;
        let currentOffset = offset;

        while (remaining > 0) {
            const chunkIndex = Math.floor(currentOffset / CHUNK_SIZE);
            const offsetInChunk = currentOffset % CHUNK_SIZE;

            const chunk = await this.getChunk(chunkIndex);
            const chunkData = new Uint8Array(chunk);

            const availableInChunk = chunkData.length - offsetInChunk;
            const toCopy = Math.min(remaining, availableInChunk);

            result.set(
                chunkData.subarray(offsetInChunk, offsetInChunk + toCopy),
                resultOffset
            );

            resultOffset += toCopy;
            currentOffset += toCopy;
            remaining -= toCopy;
        }

        return result;
    }

    /**
     * Preload all chunks - useful if you want to ensure the entire PDF is available.
     */
    async preloadAll(): Promise<void> {
        for (let i = 0; i < this.totalChunks; i++) {
            await this.getChunk(i);
        }
    }

    /**
     * Clear the chunk cache to free memory.
     */
    clearCache(): void {
        this.chunkCache.clear();
    }
}
