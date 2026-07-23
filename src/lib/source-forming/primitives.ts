import type { CsvColumn } from "@/lib/api-types";
import type { DatasetFormingFinding } from "@/lib/dataset-forming/types";

import type {
  MutableFindingInput,
  SourceCountryPolicy,
  SourceCountryReference,
  SourceRopReference,
  SourceSemanticType,
} from "./types";

const BLANK_VALUES = new Set(["", "-", "–", "—", "na", "n/a", "none", "null"]);
const TRUE_VALUES = new Set([
  "1",
  "true",
  "yes",
  "y",
  "engaged",
  "indigenous",
  "available",
]);
const FALSE_VALUES = new Set([
  "0",
  "false",
  "no",
  "n",
  "unengaged",
  "diaspora",
  "not available",
  "unavailable",
]);

export function normalizeNfkcText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function normalizeExactLookup(value: unknown) {
  return normalizeNfkcText(value).toLowerCase();
}

export function normalizeAccentPunctuationInsensitiveLookup(value: unknown) {
  return normalizeNfkcText(value)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

export function normalizeIdentifier(value: unknown) {
  return normalizeNfkcText(value);
}

export function isBlankSourceValue(value: unknown) {
  return BLANK_VALUES.has(normalizeExactLookup(value));
}

export type SourceValueConversion = Readonly<{
  value: string;
  valid: boolean;
  blank: boolean;
}>;

export function convertSourceValue(
  type: SourceSemanticType,
  rawValue: unknown,
): SourceValueConversion {
  const trimmed = normalizeNfkcText(rawValue);
  if (type === "string" || type === "identifier") {
    if (!trimmed || ["-", "–", "—"].includes(trimmed)) {
      return { value: "", valid: true, blank: true };
    }
    return { value: trimmed, valid: true, blank: false };
  }

  if (isBlankSourceValue(trimmed)) {
    return { value: "", valid: true, blank: true };
  }

  if (type === "boolean") {
    const key = normalizeExactLookup(trimmed);
    if (TRUE_VALUES.has(key)) {
      return { value: "TRUE", valid: true, blank: false };
    }
    if (FALSE_VALUES.has(key)) {
      return { value: "FALSE", valid: true, blank: false };
    }
    return { value: "", valid: false, blank: false };
  }

  if (type === "integer") {
    const normalized = trimmed.replace(/[\s,]/gu, "");
    if (/^[+-]?\d+$/u.test(normalized)) {
      return {
        value: BigInt(normalized).toString(),
        valid: true,
        blank: false,
      };
    }
    return { value: "", valid: false, blank: false };
  }

  if (type === "double") {
    const normalized = trimmed.replace(/[\s,]/gu, "");
    const numeric = Number(normalized);
    if (normalized && Number.isFinite(numeric)) {
      return { value: String(numeric), valid: true, blank: false };
    }
    return { value: "", valid: false, blank: false };
  }

  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(trimmed)
    ? `${trimmed}T00:00:00.000Z`
    : trimmed;
  const explicitlyZoned =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      isoDateOnly,
    );
  const millis = explicitlyZoned ? Date.parse(isoDateOnly) : Number.NaN;
  return Number.isFinite(millis)
    ? { value: new Date(millis).toISOString(), valid: true, blank: false }
    : { value: "", valid: false, blank: false };
}

export function createSourceColumnIndex(columns: readonly CsvColumn[]) {
  const exact = new Map<string, string>();
  const normalized = new Map<string, string>();
  for (const column of columns) {
    if (!exact.has(column.label)) exact.set(column.label, column.key);
    const lookup = normalizeExactLookup(column.label);
    if (!normalized.has(lookup)) normalized.set(lookup, column.key);
  }
  return {
    get(label: string) {
      return exact.get(label) ?? normalized.get(normalizeExactLookup(label)) ?? null;
    },
    value(row: Readonly<Record<string, string>>, label: string) {
      const key = exact.get(label) ?? normalized.get(normalizeExactLookup(label));
      return key ? row[key] ?? "" : "";
    },
  };
}

export function createFinding(input: MutableFindingInput): DatasetFormingFinding {
  return { ...input, details: input.details ?? {} };
}

export type CountryReferenceIndex = Readonly<{
  byIso3: ReadonlyMap<string, SourceCountryReference>;
  byExactAlias: ReadonlyMap<string, SourceCountryReference>;
  ambiguousExactAliases: ReadonlySet<string>;
  byLooseAlias: ReadonlyMap<string, SourceCountryReference>;
  ambiguousLooseAliases: ReadonlySet<string>;
}>;

function addAlias(
  target: Map<string, SourceCountryReference>,
  conflicts: Set<string>,
  key: string,
  country: SourceCountryReference,
) {
  if (!key) return;
  const prior = target.get(key);
  if (prior && prior.iso3.toUpperCase() !== country.iso3.toUpperCase()) {
    conflicts.add(key);
    return;
  }
  if (!prior) target.set(key, country);
}

export function createCountryReferenceIndex(
  countries: readonly SourceCountryReference[],
): CountryReferenceIndex {
  const byIso3 = new Map<string, SourceCountryReference>();
  const byExactAlias = new Map<string, SourceCountryReference>();
  const ambiguousExactAliases = new Set<string>();
  const byLooseAlias = new Map<string, SourceCountryReference>();
  const ambiguousLooseAliases = new Set<string>();
  for (const country of countries) {
    const iso3 = normalizeIdentifier(country.iso3).toUpperCase();
    if (iso3 && !byIso3.has(iso3)) byIso3.set(iso3, country);
    for (const alias of [country.displayName, ...country.alternativeNames]) {
      addAlias(
        byExactAlias,
        ambiguousExactAliases,
        normalizeExactLookup(alias),
        country,
      );
      addAlias(
        byLooseAlias,
        ambiguousLooseAliases,
        normalizeAccentPunctuationInsensitiveLookup(alias),
        country,
      );
    }
  }
  return {
    byIso3,
    byExactAlias,
    ambiguousExactAliases,
    byLooseAlias,
    ambiguousLooseAliases,
  };
}

export type CountryResolution = Readonly<{
  status: "resolved" | "unresolved" | "ambiguous" | "conflict" | "multi";
  iso3: string;
  countryName: string;
  country: SourceCountryReference | null;
  conflictingCountry: SourceCountryReference | null;
}>;

function parseCountryScalar(value: string) {
  const trimmed = normalizeNfkcText(value);
  if (!trimmed) return { scalar: "", multi: false };
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        const values = parsed
          .map(normalizeNfkcText)
          .filter(Boolean);
        return {
          scalar: values.length === 1 ? values[0]! : trimmed,
          multi: values.length > 1,
        };
      }
    } catch {
      // The original source text is retained and resolved only by exact alias.
    }
  }
  if (trimmed.includes(";")) {
    const values = trimmed.split(";").map(normalizeNfkcText).filter(Boolean);
    if (values.length > 1) return { scalar: trimmed, multi: true };
  }
  return { scalar: trimmed, multi: false };
}

export function resolveCountryReference(input: {
  sourceIso3: string;
  sourceCountryName: string;
  policy: SourceCountryPolicy;
  index: CountryReferenceIndex;
}): CountryResolution {
  const iso3 = normalizeIdentifier(input.sourceIso3).toUpperCase();
  const countryText = parseCountryScalar(input.sourceCountryName);
  if (countryText.multi && input.policy.allowMultiCountryText) {
    return {
      status: "multi",
      iso3,
      countryName: countryText.scalar,
      country: null,
      conflictingCountry: null,
    };
  }

  const aliasKey =
    input.policy.aliasNormalization === "accent-punctuation-insensitive"
      ? normalizeAccentPunctuationInsensitiveLookup(countryText.scalar)
      : normalizeExactLookup(countryText.scalar);
  const aliases =
    input.policy.aliasNormalization === "accent-punctuation-insensitive"
      ? input.index.byLooseAlias
      : input.index.byExactAlias;
  const ambiguous =
    input.policy.aliasNormalization === "accent-punctuation-insensitive"
      ? input.index.ambiguousLooseAliases
      : input.index.ambiguousExactAliases;
  const byIso = input.index.byIso3.get(iso3) ?? null;
  const byName = aliasKey && !ambiguous.has(aliasKey)
    ? aliases.get(aliasKey) ?? null
    : null;

  if (aliasKey && ambiguous.has(aliasKey)) {
    return {
      status: "ambiguous",
      iso3,
      countryName: countryText.scalar,
      country: byIso,
      conflictingCountry: null,
    };
  }
  if (byIso) {
    if (byName && byName.iso3.toUpperCase() !== byIso.iso3.toUpperCase()) {
      return {
        status: "conflict",
        iso3: byIso.iso3.toUpperCase(),
        countryName: byIso.displayName,
        country: byIso,
        conflictingCountry: byName,
      };
    }
    return {
      status: "resolved",
      iso3: byIso.iso3.toUpperCase(),
      countryName: byIso.displayName,
      country: byIso,
      conflictingCountry: null,
    };
  }
  if (!iso3 && byName) {
    return {
      status: "resolved",
      iso3: byName.iso3.toUpperCase(),
      countryName: byName.displayName,
      country: byName,
      conflictingCountry: null,
    };
  }
  return {
    status: "unresolved",
    iso3,
    countryName: countryText.scalar,
    country: null,
    conflictingCountry: null,
  };
}

export type RopReferenceIndex = Readonly<{
  byRop3: ReadonlyMap<string, SourceRopReference>;
  conflictingRop3: ReadonlySet<string>;
}>;

export function createRopReferenceIndex(
  entries: readonly SourceRopReference[],
): RopReferenceIndex {
  const byRop3 = new Map<string, SourceRopReference>();
  const conflictingRop3 = new Set<string>();
  for (const entry of entries) {
    const key = normalizeIdentifier(entry.rop3Code);
    if (!key) continue;
    const prior = byRop3.get(key);
    if (prior && JSON.stringify(prior) !== JSON.stringify(entry)) {
      conflictingRop3.add(key);
    } else if (!prior) {
      byRop3.set(key, entry);
    }
  }
  return { byRop3, conflictingRop3 };
}

export function createStableSourceRowKey(input: {
  sourceProfileKey: string;
  selector: string;
  sourceIdentifier: string;
}) {
  const profile = normalizeExactLookup(input.sourceProfileKey);
  const selector = normalizeExactLookup(input.selector).replace(/\s+/gu, "-");
  const identifier = normalizeExactLookup(input.sourceIdentifier);
  return profile && selector && identifier
    ? `${profile}:${selector}:${identifier}`
    : "";
}

export function extractSingleScalarIdentifier(value: string) {
  const trimmed = normalizeNfkcText(value);
  if (!trimmed) return { value: "", scalar: false };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      const values = parsed
        .map(normalizeIdentifier)
        .filter((candidate) => candidate && /^\d+$/u.test(candidate));
      return values.length === 1
        ? { value: values[0]!, scalar: true }
        : { value: "", scalar: false };
    }
  } catch {
    // A plain scalar is handled below.
  }
  return /^\d+$/u.test(trimmed)
    ? { value: trimmed, scalar: true }
    : { value: "", scalar: false };
}

export function groupDuplicateIndexes(values: readonly string[]) {
  const groups = new Map<string, number[]>();
  values.forEach((value, index) => {
    if (!value) return;
    groups.set(value, [...(groups.get(value) ?? []), index]);
  });
  return new Map([...groups].filter(([, indexes]) => indexes.length > 1));
}
