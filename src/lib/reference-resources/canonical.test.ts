import { describe, expect, it } from "vitest";

import {
  canonicalizeReferenceResource,
  checksumReferenceResource,
  decodeReferenceResourceCursor,
  encodeReferenceResourceCursor,
} from "./canonical";

describe("reference resource canonicalization", () => {
  it("sorts object keys recursively while preserving array order", () => {
    expect(
      canonicalizeReferenceResource({ z: 1, a: { y: 2, b: 3 }, rows: [2, 1] }),
    ).toBe('{"a":{"b":3,"y":2},"rows":[2,1],"z":1}');
  });

  it("produces the same SHA-256 checksum for equivalent objects", () => {
    expect(checksumReferenceResource({ b: 2, a: 1 })).toBe(
      checksumReferenceResource({ a: 1, b: 2 }),
    );
    expect(checksumReferenceResource({ a: 1, b: 2 })).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("round-trips stable opaque cursors and rejects malformed values", () => {
    const cursor = encodeReferenceResourceCursor("rop3-100425");
    expect(decodeReferenceResourceCursor(cursor)).toBe("rop3-100425");
    expect(decodeReferenceResourceCursor("not-base64-json")).toBeNull();
    expect(decodeReferenceResourceCursor(null)).toBeNull();
  });
});
