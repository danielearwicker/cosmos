import { expect, test } from "bun:test";
import { bytesToHex, decodeHexDigit, hexToBytes } from "./localStorageBackend";

test("gets digit values", () => {
    expect(decodeHexDigit("0")).toBe(0);
    expect(decodeHexDigit("9")).toBe(9);
    expect(decodeHexDigit("A")).toBe(10);
    expect(decodeHexDigit("F")).toBe(15);
});

test("decodes hex", () => {
    const bytes = hexToBytes("00010990990A0FF0FF", 0, 18);
    expect(bytes.length).toBe(9);
    expect(bytes[0]).toBe(0);
    expect(bytes[1]).toBe(1);
    expect(bytes[2]).toBe(9);
    expect(bytes[3]).toBe(144);
    expect(bytes[4]).toBe(153);
    expect(bytes[5]).toBe(10);
    expect(bytes[6]).toBe(15);
    expect(bytes[7]).toBe(240);
    expect(bytes[8]).toBe(255);
});

test("encodes hex", () => {
    const bytes = new Uint8Array(9);
    bytes[0] = 0;
    bytes[1] = 1;
    bytes[2] = 9;
    bytes[3] = 144;
    bytes[4] = 153;
    bytes[5] = 10;
    bytes[6] = 15;
    bytes[7] = 240;
    bytes[8] = 255;

    const hex = bytesToHex(bytes);
    expect(hex).toBe("00010990990A0FF0FF");
});
