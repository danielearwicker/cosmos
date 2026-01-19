import type { AbstractBlobClient } from "./Storage";

export function blobshopBackend(url: string, name: string): AbstractBlobClient {
    return {
        async download() {
            const response = await fetch(new URL(`/read/${name}`, url));
            const etag =
                (response.ok && response.headers.get("ETag")) || undefined;
            return {
                etag,
                blobBody: response.ok ? response.blob() : undefined,
            };
        },
        async uploadData(data, options) {
            const response = await fetch(new URL(`/write/${name}`, url), {
                method: "PUT",
                body: data,
                headers: options.conditions?.ifMatch
                    ? {
                          ["If-Match"]: options.conditions.ifMatch,
                      }
                    : {},
            });
            if (response.status === 412) {
                throw new Error("Version mismatch");
            }
            const etag = response.headers.get("ETag") ?? undefined;
            return { etag };
        },
        async stageBlock(blockId, data) {
            const response = await fetch(
                new URL(`/block/${name}/${encodeURIComponent(blockId)}`, url),
                {
                    method: "PUT",
                    body: data,
                }
            );
            if (!response.ok) {
                throw new Error(`Failed to stage block: ${response.status}`);
            }
        },
        async commitBlockList(blockIds, options) {
            const response = await fetch(new URL(`/commit/${name}`, url), {
                method: "PUT",
                body: JSON.stringify(blockIds),
                headers: {
                    "Content-Type": "application/json",
                    ...(options.conditions?.ifMatch
                        ? { ["If-Match"]: options.conditions.ifMatch }
                        : {}),
                },
            });
            if (response.status === 412) {
                throw new Error("Version mismatch");
            }
            if (!response.ok) {
                throw new Error(`Failed to commit blocks: ${response.status}`);
            }
            const etag = response.headers.get("ETag") ?? undefined;
            return { etag };
        },
        async getProperties() {
            const response = await fetch(new URL(`/props/${name}`, url), {
                method: "HEAD",
            });
            return {
                contentLength: parseInt(
                    response.headers.get("Content-Length") ?? "0",
                    10
                ),
                etag: response.headers.get("ETag") ?? undefined,
            };
        },
        async downloadRange(offset, count) {
            const response = await fetch(new URL(`/read/${name}`, url), {
                headers: {
                    Range: `bytes=${offset}-${offset + count - 1}`,
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to download range: ${response.status}`);
            }
            return response.arrayBuffer();
        },
        async delete() {
            const response = await fetch(new URL(`/delete/${name}`, url), {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error(`Failed to delete blob: ${response.status}`);
            }
        },
    };
}
