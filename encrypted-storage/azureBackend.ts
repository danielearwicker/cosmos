import type { AbstractBlobClient } from "./Storage";
import { BlobServiceClient } from "@azure/storage-blob";

export function azureBackend(url: string, name: string): AbstractBlobClient {
    const client = new BlobServiceClient(url);
    const container = client.getContainerClient("data");
    const blobClient = container.getBlockBlobClient(name);

    return {
        download() {
            return blobClient.download();
        },
        uploadData(data, options) {
            return blobClient.uploadData(data, options);
        },
        delete() {
            return blobClient.delete();
        },
        async stageBlock(blockId, data) {
            await blobClient.stageBlock(blockId, data, data.byteLength);
        },
        async commitBlockList(blockIds, options) {
            return blobClient.commitBlockList(blockIds, options);
        },
        async getProperties() {
            const props = await blobClient.getProperties();
            return {
                contentLength: props.contentLength ?? 0,
                etag: props.etag,
            };
        },
        async downloadRange(offset, count) {
            const response = await blobClient.download(offset, count);
            const blob = await response.blobBody;
            return blob!.arrayBuffer();
        },
    };
}
