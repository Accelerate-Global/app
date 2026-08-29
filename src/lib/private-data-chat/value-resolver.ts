import type { IsoCountryCodeEntry } from "@/lib/iso-country-codes";
import { getActiveReferenceResource } from "@/lib/reference-resources";
import {
  COUNTRY_RESOURCE_KEY,
  type ReferenceResourceVersionSummary,
} from "@/lib/reference-resources/types";
import type {
  PrivateDataChatFilter,
  PrivateDataChatQuery,
} from "@/lib/private-data-chat/schemas";
import { normalizeAccentPunctuationInsensitiveLookup } from "@/lib/source-forming/primitives";

export type PrivateDataChatValueBinding = Readonly<{
  field: "country";
  filterIndex: number;
  resourceKey: typeof COUNTRY_RESOURCE_KEY;
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

export type PrivateDataChatValueResolverDependencies = Readonly<{
  loadCountryValues: () => Promise<CountryValueResource>;
}>;

async function loadActiveCountryValues(): Promise<CountryValueResource> {
  const active = await getActiveReferenceResource(COUNTRY_RESOURCE_KEY);
  return {
    entries: active.payload.entries,
    version: active.version,
  };
}

const productionDependencies: PrivateDataChatValueResolverDependencies = {
  loadCountryValues: loadActiveCountryValues,
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
    value: matches.values().next().value!.displayName,
  };
}

export async function resolvePrivateDataChatQueryValues(
  query: PrivateDataChatQuery,
  dependencies: PrivateDataChatValueResolverDependencies = productionDependencies,
): Promise<PrivateDataChatValueResolution> {
  if (!hasResolvableCountryValue(query)) {
    return { status: "resolved", query, valueBindings: [] };
  }

  let resource: CountryValueResource;
  try {
    resource = await dependencies.loadCountryValues();
  } catch {
    throw new PrivateDataChatValueResolutionError();
  }

  const index = buildCountryValueIndex(resource.entries);
  const valueBindings: PrivateDataChatValueBinding[] = [];
  const ambiguities: string[][] = [];

  const filters = query.filters.map((filter, filterIndex) => {
    if (filter.field !== "country" || filter.value === null) {
      return filter;
    }

    const originalValues = Array.isArray(filter.value)
      ? filter.value
      : [filter.value];
    let matched = false;
    const values = originalValues.map((value) => {
      const resolution = resolveCountryValue(value, index);
      if (resolution.status === "ambiguous") {
        if (ambiguities.length === 0) {
          ambiguities.push(resolution.matches);
        }
        return value;
      }
      if (resolution.status === "resolved") {
        matched = true;
        return resolution.value;
      }
      return value;
    });

    if (matched) {
      valueBindings.push({
        field: "country",
        filterIndex,
        resourceKey: COUNTRY_RESOURCE_KEY,
        resourceVersionId: resource.version.id,
        resourceVersionNumber: resource.version.versionNumber,
        resourceContentChecksum: resource.version.contentChecksum,
      });
    }

    return {
      ...filter,
      value: Array.isArray(filter.value) ? values : values[0]!,
    } as PrivateDataChatFilter;
  });

  const ambiguity = ambiguities[0];
  if (ambiguity) {
    return {
      status: "clarify",
      question: `That country value matches more than one approved country (${ambiguity.join(", ")}). Which country did you mean?`,
      reason: "The approved country reference has more than one exact normalized match.",
    };
  }

  return {
    status: "resolved",
    query: { ...query, filters } as PrivateDataChatQuery,
    valueBindings,
  };
}
