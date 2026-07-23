import { createHash } from "node:crypto";

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  }

  return value;
}

export function canonicalizeSourceFormingValue(value: unknown) {
  return JSON.stringify(canonicalValue(value));
}

export function checksumSourceFormingValue(value: unknown) {
  return createHash("sha256")
    .update(canonicalizeSourceFormingValue(value), "utf8")
    .digest("hex");
}

export function deepFreezeSourceFormingValue<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreezeSourceFormingValue(child);
    }
    Object.freeze(value);
  }
  return value;
}
