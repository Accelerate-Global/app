import type { IsoCountryCodeEntry } from "@/lib/iso-country-codes";
import {
  getCompatibleFilterRegionAliases,
  normalizeCompatibleRegionName,
} from "@/lib/canonical-filter-regions";
import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_DATASET_KEY,
  type PrivateDataChatMetricKey,
} from "@/lib/private-data-chat/catalog";
import {
  loadPrivateDataChatFilterRegionSource,
  type PrivateDataChatFilterRegionSource,
} from "@/lib/private-data-chat/filter-region-source";
import { PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION } from "@/lib/private-data-chat/named-filters";
import {
  privateDataChatQuerySchema,
  type PrivateDataChatQuery,
} from "@/lib/private-data-chat/schemas";
import { getActiveReferenceResource } from "@/lib/reference-resources";
import { COUNTRY_RESOURCE_KEY } from "@/lib/reference-resources/types";
import { normalizeAccentPunctuationInsensitiveLookup } from "@/lib/source-forming/primitives";

const MAX_FILTER_REGION_COUNTRIES = 50;
const SAFE_GEOGRAPHY_CANDIDATE =
  /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ,.'’()&/-]{0,199}$/u;

export type PrivateDataChatApprovedCountry = Readonly<{
  displayName: string;
  aliases: readonly string[];
}>;

export type PrivateDataChatResolvedGeographyIntent = Readonly<{
  status: "resolved";
  metric: Extract<
    PrivateDataChatMetricKey,
    "total_population" | "people_group_count"
  >;
  scope:
    | Readonly<{
        kind: "country";
        canonicalName: string;
        displayName: string;
      }>
    | Readonly<{
        kind: "region";
        canonicalName: string;
        displayName: string;
        countries: readonly string[];
        global: boolean;
        sourceChecksum: string;
      }>;
  requiredSemanticKeys: readonly [string, string];
  resolverViews: readonly Readonly<{ stableKey: string; text: string }>[];
}>;

export type PrivateDataChatGeographyIntentResolution =
  | PrivateDataChatResolvedGeographyIntent
  | Readonly<{ status: "none" }>
  | Readonly<{
      status: "clarify";
      reason: "geography-ambiguous" | "filter-region-too-broad";
      question: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "country-resource-unavailable"
        | "filter-regions-unavailable"
        | "filter-regions-stale"
        | "filter-region-empty";
      message: string;
    }>;

export type PrivateDataChatGeographyResolverDependencies = Readonly<{
  loadFilterRegionSource: () => Promise<PrivateDataChatFilterRegionSource>;
  loadApprovedCountries: () => Promise<readonly PrivateDataChatApprovedCountry[]>;
}>;

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

async function loadApprovedCountries() {
  const active = await getActiveReferenceResource(COUNTRY_RESOURCE_KEY);
  return active.payload.entries
    .filter((entry) => entry.active)
    .map((entry) => ({
      displayName: entry.displayName,
      aliases: countryAliases(entry),
    }));
}

const productionDependencies: PrivateDataChatGeographyResolverDependencies = {
  loadFilterRegionSource: loadPrivateDataChatFilterRegionSource,
  loadApprovedCountries,
};

function naturalMetric(question: string) {
  const normalized = normalizeAccentPunctuationInsensitiveLookup(question);
  if (/\bhow many people groups?\b/u.test(normalized)) {
    return "people_group_count" as const;
  }
  if (/\bhow many people\b/u.test(normalized)) {
    return "total_population" as const;
  }
  return null;
}

function geographyCandidate(question: string) {
  const match = question.match(
    /\b(?:in|within|across|from)\s+(.+?)\s*[?.!]*$/iu,
  );
  const candidate = match?.[1]?.trim() ?? "";
  return candidate && SAFE_GEOGRAPHY_CANDIDATE.test(candidate)
    ? candidate
    : null;
}

type CandidateScope =
  | Readonly<{ kind: "country"; key: string; canonicalName: string }>
  | Readonly<{
      kind: "region";
      key: string;
      canonicalName: string;
      countries: readonly string[];
      sourceChecksum: string;
    }>;

function addAlias(
  index: Map<string, Map<string, CandidateScope>>,
  alias: string,
  scope: CandidateScope,
) {
  const normalized = normalizeAccentPunctuationInsensitiveLookup(alias);
  if (!normalized) return;
  const matches = index.get(normalized) ?? new Map<string, CandidateScope>();
  matches.set(scope.key, scope);
  index.set(normalized, matches);
}

function containsPhrase(text: string, phrase: string) {
  return (` ${text} `).includes(` ${phrase} `);
}

function resolveIndexMatch(
  candidate: string,
  index: ReadonlyMap<string, ReadonlyMap<string, CandidateScope>>,
) {
  const normalized = normalizeAccentPunctuationInsensitiveLookup(candidate);
  const exact = index.get(normalized);
  if (exact && exact.size === 1) {
    return { status: "resolved" as const, scope: exact.values().next().value! };
  }
  if (exact && exact.size > 1) {
    return { status: "ambiguous" as const };
  }
  const contained = new Map<string, CandidateScope>();
  for (const [alias, scopes] of index) {
    if (!containsPhrase(normalized, alias)) continue;
    for (const [key, scope] of scopes) contained.set(key, scope);
  }
  return contained.size > 1
    ? { status: "ambiguous" as const }
    : { status: "none" as const };
}

export async function resolvePrivateDataChatGeographyIntent(
  input: {
    question: string;
    expectedFilterRegionChecksum: string | null | undefined;
  },
  dependencies: Partial<PrivateDataChatGeographyResolverDependencies> = {},
): Promise<PrivateDataChatGeographyIntentResolution> {
  const metric = naturalMetric(input.question);
  const candidate = metric ? geographyCandidate(input.question) : null;
  if (!metric || !candidate) return { status: "none" };

  const resolvedDependencies = { ...productionDependencies, ...dependencies };
  const [filterRegionResult, countryResult] = await Promise.allSettled([
    resolvedDependencies.loadFilterRegionSource(),
    resolvedDependencies.loadApprovedCountries(),
  ]);
  if (filterRegionResult.status === "rejected") {
    return {
      status: "unavailable",
      reason: "filter-regions-unavailable",
      message:
        "The reviewed filter-region definitions are temporarily unavailable. Please try again.",
    };
  }
  if (countryResult.status === "rejected") {
    return {
      status: "unavailable",
      reason: "country-resource-unavailable",
      message:
        "The reviewed geography resources are temporarily unavailable. Please try again.",
    };
  }
  const filterRegionSource = filterRegionResult.value;
  const countries = countryResult.value;

  const index = new Map<string, Map<string, CandidateScope>>();
  for (const country of countries) {
    const scope: CandidateScope = {
      kind: "country",
      key: `country:${country.displayName}`,
      canonicalName: country.displayName,
    };
    for (const alias of country.aliases) addAlias(index, alias, scope);
  }
  for (const region of filterRegionSource.regions) {
    const scope: CandidateScope = {
      kind: "region",
      key: `region:${region.id}`,
      canonicalName: region.name,
      countries: region.countries,
      sourceChecksum: filterRegionSource.checksum,
    };
    for (const alias of [
      region.name,
      ...getCompatibleFilterRegionAliases(region.name),
    ]) {
      addAlias(index, alias, scope);
    }
  }

  const match = resolveIndexMatch(candidate, index);
  if (match.status === "none") return { status: "none" };
  if (match.status === "ambiguous") {
    return {
      status: "clarify",
      reason: "geography-ambiguous",
      question:
        "That geography matches more than one reviewed country or filter region. Which one did you mean?",
    };
  }

  const semanticKey = `metric.${metric}`;
  if (match.scope.kind === "country") {
    return {
      status: "resolved",
      metric,
      scope: {
        kind: "country",
        canonicalName: match.scope.canonicalName,
        displayName: candidate,
      },
      requiredSemanticKeys: ["field.country", semanticKey],
      resolverViews: [
        {
          stableKey: "field.country",
          text: `Approved country: ${match.scope.canonicalName}`,
        },
        {
          stableKey: semanticKey,
          text:
            metric === "total_population"
              ? "Resolved metric: Total population"
              : "Resolved metric: People-group count",
        },
      ],
    };
  }

  if (!input.expectedFilterRegionChecksum) {
    return {
      status: "unavailable",
      reason: "filter-regions-unavailable",
      message:
        "The reviewed filter-region snapshot is unavailable. Please refresh the semantic context before trying again.",
    };
  }
  if (input.expectedFilterRegionChecksum !== match.scope.sourceChecksum) {
    return {
      status: "unavailable",
      reason: "filter-regions-stale",
      message:
        "The reviewed filter-region definitions changed. Please refresh the semantic context before trying again.",
    };
  }
  const global =
    normalizeCompatibleRegionName(match.scope.canonicalName).toLocaleLowerCase() ===
    "global";
  if (!global && match.scope.countries.length === 0) {
    return {
      status: "unavailable",
      reason: "filter-region-empty",
      message: "That reviewed filter region currently contains no countries.",
    };
  }
  if (!global && match.scope.countries.length > MAX_FILTER_REGION_COUNTRIES) {
    return {
      status: "clarify",
      reason: "filter-region-too-broad",
      question:
        "That filter region expands beyond the approved query bound. Please choose a narrower reviewed region or country.",
    };
  }
  return {
    status: "resolved",
    metric,
    scope: {
      kind: "region",
      canonicalName: match.scope.canonicalName,
      displayName: candidate,
      countries: [...match.scope.countries],
      global,
      sourceChecksum: match.scope.sourceChecksum,
    },
    requiredSemanticKeys: ["field.country", semanticKey],
    resolverViews: [
      {
        stableKey: "field.country",
        text: `Reviewed filter region: ${match.scope.canonicalName}`,
      },
      {
        stableKey: semanticKey,
        text:
          metric === "total_population"
            ? "Resolved metric: Total population"
            : "Resolved metric: People-group count",
      },
    ],
  };
}

export function buildPrivateDataChatGeographyQuery(
  resolution: PrivateDataChatResolvedGeographyIntent,
): PrivateDataChatQuery {
  const values =
    resolution.scope.kind === "country"
      ? [resolution.scope.canonicalName]
      : resolution.scope.global
        ? []
        : [...resolution.scope.countries];
  return privateDataChatQuerySchema.parse({
    catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    namedFilterRegistryVersion:
      PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
    dataset: PRIVATE_DATA_CHAT_DATASET_KEY,
    mode: "aggregate",
    metrics: [resolution.metric],
    dimensions: [],
    filters:
      values.length === 0
        ? []
        : [
            {
              field: "country",
              operator: values.length === 1 ? "eq" : "in",
              value: values.length === 1 ? values[0]! : values,
            },
          ],
    namedFilters: [],
    sort: [],
    limit: 1,
  });
}
