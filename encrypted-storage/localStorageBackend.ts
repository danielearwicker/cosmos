import type { AbstractBlobClient } from "./Storage";

const codes = {
    [0]: "0".charCodeAt(0),
    [9]: "9".charCodeAt(0),
    A: "A".charCodeAt(0),
    F: "F".charCodeAt(0),
};

export function decodeHexDigit(d: string) {
    const c = d.charCodeAt(0);
    if (c >= codes[0] && c <= codes[9]) {
        return c - codes[0];
    }
    if (c >= codes.A && c <= codes.F) {
        return c - codes.A + 10;
    }
    throw new Error(`'${d}' ain't no hex digit`);
}

export function encodeHexDigit(d: number) {
    if (d >= 0 && d <= 9) {
        return codes[0] + d;
    }
    if (d >= 10 && d <= 15) {
        return codes.A + (d - 10);
    }
    throw new Error(`${d} can't be hexified`);
}

export function hexToBytes(hex: string, from: number, count: number) {
    const bytes = new Uint8Array(count / 2);

    for (let n = 0; n < bytes.length; n++) {
        const at = from + n * 2;
        const d1 = decodeHexDigit(hex[at]);
        const d2 = decodeHexDigit(hex[at + 1]);

        bytes[n] = d1 * 16 + d2;
    }

    return bytes;
}

export function bytesToHex(source: BufferSource) {
    const bytes = new Uint8Array(source as ArrayBufferLike);
    const chars = new Uint8Array(bytes.length * 2);

    for (let n = 0; n < bytes.length; n++) {
        const b = bytes[n];
        const d1 = Math.floor(b / 16);
        const d2 = b - d1 * 16;
        chars[n * 2] = encodeHexDigit(d1);
        chars[n * 2 + 1] = encodeHexDigit(d2);
    }

    return new TextDecoder().decode(chars);
}

const guidLength = 36;

export function localStorageBackend(
    url: string,
    name: string
): AbstractBlobClient {
    return {
        download() {
            const result = localStorage.getItem(name);
            if (!result) {
                return Promise.resolve({
                    etag: undefined,
                    blobBody: undefined,
                });
            }

            const etag = result.substring(0, guidLength);
            const blob = new Blob([
                hexToBytes(result, guidLength, result.length - guidLength),
            ]);

            return Promise.resolve({
                etag,
                blobBody: Promise.resolve(blob),
            });
        },
        uploadData(data, options) {
            // const etag = options.conditions?.ifMatch;

            const etag = crypto.randomUUID();
            const value = etag + bytesToHex(data);

            localStorage.setItem(name, value);

            return Promise.resolve({ etag });
        },
    };
}
