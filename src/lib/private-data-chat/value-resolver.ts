import type { IsoCountryCodeEntry } from "@/lib/iso-country-codes";
import type { RopCodeResource } from "@/lib/rop-codes";
import { getActiveReferenceResource } from "@/lib/reference-resources";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
  type ReferenceResourceVersionSummary,
} from "@/lib/reference-resources/types";
import type {
  PrivateDataChatFilter,
  PrivateDataChatQuery,
} from "@/lib/private-data-chat/schemas";
import { normalizeAccentPunctuationInsensitiveLookup } from "@/lib/source-forming/primitives";

export type PrivateDataChatValueBinding = Readonly<{
  field: PrivateDataChatFilter["field"];
  filterIndex: number;
  resourceKey: typeof COUNTRY_RESOURCE_KEY | typeof ROP_RESOURCE_KEY;
  resourceVersionId: string;
  resourceVersionNumber: number;
  resourceContentChecksum: string | null;
}>;

export type PrivateDataChatValueResolution =
  | Readonly<{
      status: "resolved";
      query: PrivateDataChatQuery;
      valueBindings: readonly PrivateDataChatValueBinding[];
    }>
  | Readonly<{
      status: "clarify";
      question: string;
      reason: string;
    }>;

export class PrivateDataChatValueResolutionError extends Error {
  readonly code = "semantic_resource_unavailable" as const;
  readonly retryable = true as const;

  constructor(message = "The approved semantic value resource is unavailable.") {
    super(message);
    this.name = "PrivateDataChatValueResolutionError";
  }
}

type CountryValueResource = Readonly<{
  entries: readonly IsoCountryCodeEntry[];
  version: Pick<
    ReferenceResourceVersionSummary,
    "id" | "versionNumber" | "contentChecksum"
  >;
}>;

type RopValueResource = Readonly<{
  payload: RopCodeResource;
  version: Pick<
    ReferenceResourceVersionSummary,
    "id" | "versionNumber" | "contentChecksum"
  >;
}>;

export type PrivateDataChatValueResolverDependencies = Readonly<{
  loadCountryValues: () => Promise<CountryValueResource>;
  loadRopValues: () => Promise<RopValueResource>;
}>;

async function loadActiveCountryValues(): Promise<CountryValueResource> {
  const active = await getActiveReferenceResource(COUNTRY_RESOURCE_KEY);
  return {
    entries: active.payload.entries,
    version: active.version,
  };
}

async function loadActiveRopValues(): Promise<RopValueResource> {
  const active = await getActiveReferenceResource(ROP_RESOURCE_KEY);
  return { payload: active.payload, version: active.version };
}

const productionDependencies: PrivateDataChatValueResolverDependencies = {
  loadCountryValues: loadActiveCountryValues,
  loadRopValues: loadActiveRopValues,
};

function countryAliases(entry: IsoCountryCodeEntry) {
  return [
    entry.displayName,
    ...entry.alternativeNames,
    entry.primaryAlpha3,
    entry.officialIsoAlpha2,
    entry.officialIsoAlpha3,
    entry.gencAlpha2,
    entry.gencAlpha3,
    entry.fips,
    entry.rog3,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function buildCountryValueIndex(entries: readonly IsoCountryCodeEntry[]) {
  const index = new Map<string, Map<string, IsoCountryCodeEntry>>();

  for (const entry of entries) {
    if (!entry.active) continue;

    for (const alias of countryAliases(entry)) {
      const key = normalizeAccentPunctuationInsensitiveLookup(alias);
      if (!key) continue;
      const matches = index.get(key) ?? new Map<string, IsoCountryCodeEntry>();
      matches.set(entry.displayName, entry);
      index.set(key, matches);
    }
  }

  return index;
}

function hasResolvableCountryValue(query: PrivateDataChatQuery) {
  return query.filters.some(
    (filter) =>
      filter.field === "country" &&
      (Array.isArray(filter.value)
        ? filter.value.length > 0
        : typeof filter.value === "string"),
  );
}

function hasResolvableRopValue(query: PrivateDataChatQuery) {
  return query.filters.some(
    (filter) =>
      filter.field.startsWith("rop") &&
      (Array.isArray(filter.value)
        ? filter.value.length > 0
        : typeof filter.value === "string"),
  );
}

function ropCanonicalValues(
  resource: RopCodeResource,
  field: PrivateDataChatFilter["field"],
  value: string,
) {
  const key = normalizeAccentPunctuationInsensitiveLookup(value);
  if (!key) return [];
  if (field === "rop_match_status") {
    return [
      "matched",
      "blank",
      "malformed",
      "inactive",
      "unmatched",
      "join_issue",
      "unbound",
    ].filter(
      (candidate) =>
        normalizeAccentPunctuationInsensitiveLookup(candidate) === key,
    );
  }
  if (field === "rop_geography") {
    return [
      ...new Set(
        Object.values(resource.geoIndexByRop3)
          .flat()
          .flatMap((geography) => [
            geography.geoName,
            geography.isoAlpha3,
            geography.rog,
          ])
          .filter((candidate): candidate is string => Boolean(candidate))
          .filter(
            (candidate) =>
              normalizeAccentPunctuationInsensitiveLookup(candidate) === key,
          ),
      ),
    ].sort();
  }

  const hierarchy = field.match(/^rop(1|2|25|3)_(code|name)$/u);
  if (hierarchy) {
    const property = `rop${hierarchy[1]}` as "rop1" | "rop2" | "rop25" | "rop3";
    const output = hierarchy[2] as "code" | "name";
    return [
      ...new Set(
        resource.entries.flatMap((entry) => {
          const term = entry[property];
          if (
            !term ||
            ![term.code, term.name]
              .filter((candidate): candidate is string => Boolean(candidate))
              .some(
                (candidate) =>
                  normalizeAccentPunctuationInsensitiveLookup(candidate) === key,
              )
          ) {
            return [];
          }
          const canonical = term[output];
          return canonical ? [canonical] : [];
        }),
      ),
    ].sort();
  }

  if (field === "rop_join_issue") {
    return [
      ...new Set(
        resource.entries.flatMap((entry) => {
          if (!entry.joinIssue) return [];
          return [entry.joinIssue, entry.joinIssueLabel]
            .filter((candidate): candidate is string => Boolean(candidate))
            .some(
              (candidate) =>
                normalizeAccentPunctuationInsensitiveLookup(candidate) === key,
            )
            ? [entry.joinIssue]
            : [];
        }),
      ),
    ].sort();
  }
  const values = resource.entries.flatMap((entry) => {
    if (field === "rop3_status") return [entry.status];
    if (field === "rop_place") return entry.place ? [entry.place] : [];
    if (field === "rop_language") return entry.language ? [entry.language] : [];
    if (field === "rop_source") return entry.source ? [entry.source] : [];
    return [];
  });
  return [
    ...new Set(
      values.filter(
        (candidate) =>
          normalizeAccentPunctuationInsensitiveLookup(candidate) === key,
      ),
    ),
  ].sort();
}

function resolveCountryValue(
  value: string,
  index: ReadonlyMap<string, ReadonlyMap<string, IsoCountryCodeEntry>>,
) {
  const key = normalizeAccentPunctuationInsensitiveLookup(value);
  const matches = key ? index.get(key) : undefined;
  if (!matches || matches.size === 0) {
    return { status: "unmatched" as const, value };
  }
  if (matches.size > 1) {
    return {
      status: "ambiguous" as const,
      matches: [...matches.keys()].sort((left, right) =>
        left.localeCompare(right),
      ),
    };
  }
  return {
    status: "resolved" as const,
    entry: matches.values().next().value!,
  };
}

function ropGeographyCountryCode(
  resource: RopCodeResource,
  entry: IsoCountryCodeEntry,
) {
  const available = new Map<string, string>();
  for (const geography of Object.values(resource.geoIndexByRop3).flat()) {
    for (const candidate of [geography.isoAlpha3, geography.rog]) {
      const key = candidate
        ? normalizeAccentPunctuationInsensitiveLookup(candidate)
        : "";
      if (key && candidate) available.set(key, candidate);
    }
  }

  for (const candidate of [
    entry.officialIsoAlpha3,
    entry.primaryAlpha3,
    entry.gencAlpha3,
    entry.fips,
    entry.rog3,
    entry.officialIsoAlpha2,
    entry.gencAlpha2,
  ]) {
    const key = candidate
      ? normalizeAccentPunctuationInsensitiveLookup(candidate)
      : "";
    const canonical = key ? available.get(key) : undefined;
    if (canonical) return canonical;
  }

  return null;
}

function needsCountryBackedRopGeographyResolution(
  query: PrivateDataChatQuery,
  resource: RopCodeResource,
) {
  return query.filters.some((filter) => {
    if (filter.field !== "rop_geography") return false;
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    return values.some(
      (value) =>
        typeof value === "string" &&
        ropCanonicalValues(resource, filter.field, value).length === 0,
    );
  });
}

export async function resolvePrivateDataChatQueryValues(
  query: PrivateDataChatQuery,
  dependencies: Partial<PrivateDataChatValueResolverDependencies> = {},
): Promise<PrivateDataChatValueResolution> {
  const resolvedDependencies = { ...productionDependencies, ...dependencies };
  const needsCountry = hasResolvableCountryValue(query);
  const needsRop = hasResolvableRopValue(query);
  if (!needsCountry && !needsRop) {
    return { status: "resolved", query, valueBindings: [] };
  }

  let countryResource: CountryValueResource | null = null;
  let ropResource: RopValueResource | null = null;
  try {
    [countryResource, ropResource] = await Promise.all([
      needsCountry ? resolvedDependencies.loadCountryValues() : null,
      needsRop ? resolvedDependencies.loadRopValues() : null,
    ]);
  } catch {
    throw new PrivateDataChatValueResolutionError();
  }

  if (
    !countryResource &&
    ropResource &&
    needsCountryBackedRopGeographyResolution(query, ropResource.payload)
  ) {
    try {
      countryResource = await resolvedDependencies.loadCountryValues();
    } catch {
      throw new PrivateDataChatValueResolutionError();
    }
  }

  const index = countryResource
    ? buildCountryValueIndex(countryResource.entries)
    : new Map();
  const valueBindings: PrivateDataChatValueBinding[] = [];
  const ambiguities: Array<{ field: string; matches: string[] }> = [];

  const filters = query.filters.map((filter, filterIndex) => {
    if (filter.value === null || typeof filter.value === "number" || typeof filter.value === "boolean") {
      return filter;
    }

    const originalValues = Array.isArray(filter.value)
      ? filter.value
      : [filter.value];
    if (!originalValues.every((value) => typeof value === "string")) {
      return filter;
    }
    const matchedResources = new Set<
      typeof COUNTRY_RESOURCE_KEY | typeof ROP_RESOURCE_KEY
    >();
    const values = originalValues.map((value) => {
      if (filter.field === "country" && countryResource) {
        const resolution = resolveCountryValue(value, index);
        if (resolution.status === "ambiguous") {
          if (ambiguities.length === 0) {
            ambiguities.push({ field: filter.field, matches: resolution.matches });
          }
          return value;
        }
        if (resolution.status === "resolved") {
          matchedResources.add(COUNTRY_RESOURCE_KEY);
          return resolution.entry.displayName;
        }
        return value;
      }
      if (filter.field.startsWith("rop") && ropResource) {
        const matches = ropCanonicalValues(
          ropResource.payload,
          filter.field,
          value,
        );
        if (matches.length > 1) {
          if (ambiguities.length === 0) {
            ambiguities.push({ field: filter.field, matches });
          }
          return value;
        }
        if (matches.length === 1) {
          matchedResources.add(ROP_RESOURCE_KEY);
          return matches[0]!;
        }
        if (filter.field === "rop_geography" && countryResource) {
          const countryResolution = resolveCountryValue(value, index);
          if (countryResolution.status === "ambiguous") {
            if (ambiguities.length === 0) {
              ambiguities.push({
                field: filter.field,
                matches: countryResolution.matches,
              });
            }
            return value;
          }
          if (countryResolution.status === "resolved") {
            const canonical = ropGeographyCountryCode(
              ropResource.payload,
              countryResolution.entry,
            );
            if (canonical) {
              matchedResources.add(COUNTRY_RESOURCE_KEY);
              matchedResources.add(ROP_RESOURCE_KEY);
              return canonical;
            }
          }
        }
      }
      return value;
    });

    for (const resourceKey of matchedResources) {
      const version = resourceKey === COUNTRY_RESOURCE_KEY
        ? countryResource?.version
        : ropResource?.version;
      if (!version) return filter;
      valueBindings.push({
        field: filter.field,
        filterIndex,
        resourceKey,
        resourceVersionId: version.id,
        resourceVersionNumber: version.versionNumber,
        resourceContentChecksum: version.contentChecksum,
      });
    }

    return {
      ...filter,
      value: Array.isArray(filter.value) ? values : values[0]!,
    } as PrivateDataChatFilter;
  });

  const ambiguity = ambiguities[0];
  if (ambiguity) {
    if (ambiguity.field === "country") {
      return {
        status: "clarify",
        question: `That country value matches more than one approved country (${ambiguity.matches.join(", ")}). Which country did you mean?`,
        reason:
          "The approved country reference has more than one exact normalized match.",
      };
    }
    return {
      status: "clarify",
      question: `That ${ambiguity.field.replaceAll("_", " ")} value has more than one approved exact match (${ambiguity.matches.join(", ")}). Which value did you mean?`,
      reason: "The approved reference resource has more than one exact normalized match.",
    };
  }

  return {
    status: "resolved",
    query: { ...query, filters } as PrivateDataChatQuery,
    valueBindings,
  };
}
