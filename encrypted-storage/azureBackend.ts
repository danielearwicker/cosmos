import type { AbstractBlobClient } from "./Storage";
import { BlobServiceClient } from "@azure/storage-blob";

export function azureBackend(url: string, name: string): AbstractBlobClient {
    const client = new BlobServiceClient(url);
    const container = client.getContainerClient("data");
    return container.getBlockBlobClient(name);
}
