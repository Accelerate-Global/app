import { createHash } from "node:crypto";

export function normalizeProductText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function normalizeTier1SourceKey(value: unknown) {
  const normalized = normalizeProductText(value).toLocaleLowerCase();
  if (normalized === "et" || normalized === "etn") return "etno";
  if (normalized === "im") return "imb";
  return normalized;
}

export function normalizeIso3(value: unknown) {
  return normalizeProductText(value).toUpperCase();
}

export function normalizeRop3(value: unknown) {
  const normalized = normalizeProductText(value).replace(/\.0+$/u, "");
  return /^\d{1,6}$/u.test(normalized) ? normalized.padStart(6, "0") : normalized;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function canonicalProductJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function checksumProductValue(value: unknown) {
  return createHash("sha256").update(canonicalProductJson(value)).digest("hex");
}

export function parseFiniteDecimal(value: unknown) {
  const normalized = normalizeProductText(value).replaceAll(",", "").replace(/%$/u, "");
  if (!normalized) return { value: null, invalid: false } as const;
  const parsed = Number(normalized);
  return Number.isFinite(parsed)
    ? ({ value: parsed, invalid: false } as const)
    : ({ value: null, invalid: true } as const);
}

export function parseBooleanValue(value: unknown) {
  const normalized = normalizeProductText(value).toLocaleLowerCase();
  if (["true", "t", "1", "yes", "y", "on", "available", "engaged"].includes(normalized)) {
    return true;
  }
  if (["false", "f", "0", "no", "n", "off", "not available", "unengaged"].includes(normalized)) {
    return false;
  }
  return null;
}

export function truncateDecimal(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.trunc((value + Number.EPSILON) * factor) / factor;
}

export function numberToProductText(value: number) {
  if (!Number.isFinite(value)) return "";
  return String(Object.is(value, -0) ? 0 : value);
}
