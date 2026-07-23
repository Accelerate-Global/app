import { createHash } from "node:crypto";

function normalizeDatasetFormingValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeDatasetFormingValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeDatasetFormingValue(child)]),
    );
  }

  return value;
}

export function canonicalizeDatasetFormingValue(value: unknown) {
  return JSON.stringify(normalizeDatasetFormingValue(value));
}

export function checksumDatasetFormingValue(value: unknown) {
  return createHash("sha256")
    .update(canonicalizeDatasetFormingValue(value), "utf8")
    .digest("hex");
}
