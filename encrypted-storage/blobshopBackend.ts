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
    };
}
