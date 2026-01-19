const algorithm = {
    name: "AES-GCM",
    length: 256,
};

export const CHUNK_SIZE = 1024 * 1024; // 1MB plaintext chunks
export const IV_SIZE = 12;
export const AUTH_TAG_SIZE = 16;
export const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + IV_SIZE + AUTH_TAG_SIZE;

const keyConfig = [algorithm, true, ["encrypt", "decrypt"]] as const;

export async function generateEncryptionKey() {
    const key = await window.crypto.subtle.generateKey(...keyConfig);

    return btoa(
        JSON.stringify(await window.crypto.subtle.exportKey("jwk", key))
    );
}

async function importKey(key: string) {
    return await window.crypto.subtle.importKey(
        "jwk",
        JSON.parse(atob(key)),
        ...keyConfig
    );
}

export async function encrypt(bytes: BufferSource, key: string) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt(
        { ...algorithm, iv },
        await importKey(key),
        bytes
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return combined;
}

export function encryptText(data: string, key: string) {
    return encrypt(new TextEncoder().encode(data), key);
}

export async function decrypt(data: ArrayBufferLike, key: string) {
    const iv = new DataView(data, 0, 12);
    const encrypted = new DataView(data, 12);

    const plain = await window.crypto.subtle.decrypt(
        { ...algorithm, iv },
        await importKey(key),
        encrypted
    );

    return plain;
}

export async function decryptText(data: ArrayBufferLike, key: string) {
    return new TextDecoder().decode(await decrypt(data, key));
}
