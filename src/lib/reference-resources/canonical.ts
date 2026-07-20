import { createHash } from "node:crypto";

function normalizeCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeCanonicalValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeCanonicalValue(child)]),
    );
  }

  return value;
}

export function canonicalizeReferenceResource(value: unknown) {
  return JSON.stringify(normalizeCanonicalValue(value));
}

export function checksumReferenceResource(value: unknown) {
  return createHash("sha256")
    .update(canonicalizeReferenceResource(value), "utf8")
    .digest("hex");
}

export function encodeReferenceResourceCursor(stableKey: string) {
  return Buffer.from(JSON.stringify({ stableKey }), "utf8").toString("base64url");
}

export function decodeReferenceResourceCursor(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return typeof parsed?.stableKey === "string" && parsed.stableKey
      ? parsed.stableKey
      : null;
  } catch {
    return null;
  }
}
