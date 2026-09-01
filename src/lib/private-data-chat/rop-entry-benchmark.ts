import { performance } from "node:perf_hooks";

import type { RopCodeEntry, RopCodeResource } from "@/lib/rop-codes";

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

const SEARCH_STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "entry",
  "entries",
  "find",
  "for",
  "in",
  "is",
  "list",
  "not",
  "of",
  "on",
  "or",
  "reviewed",
  "rop",
  "show",
  "the",
  "to",
  "value",
  "values",
  "what",
  "with",
]);

function terms(value: string) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((term) => term.length > 1 && !SEARCH_STOP_WORDS.has(term)),
  );
}

function entryValues(resource: RopCodeResource, entry: RopCodeEntry) {
  const rop3Code = entry.rop3?.code ?? null;
  const geographies = rop3Code ? resource.geoIndexByRop3[rop3Code] ?? [] : [];
  return [
    entry.id,
    entry.rowType,
    entry.rop1?.code,
    entry.rop1?.name,
    entry.rop2?.code,
    entry.rop2?.name,
    entry.rop25?.code,
    entry.rop25?.name,
    entry.rop3?.code,
    entry.rop3?.name,
    entry.status,
    entry.place,
    entry.language,
    entry.source,
    entry.joinIssue,
    entry.joinIssueLabel,
    entry.rop1 ? resource.rop1DetailsByCode[entry.rop1.code]?.description : null,
    entry.rop2 ? resource.rop2DetailsByCode[entry.rop2.code]?.description : null,
    entry.rop25 ? resource.rop25DetailsByCode[entry.rop25.code]?.description : null,
    entry.rop3 ? resource.rop3DetailsByCode[entry.rop3.code]?.description : null,
    ...geographies.flatMap((geography) => [
      geography.rog,
      geography.geoName,
      geography.peopleName,
      geography.peopleId3,
      geography.isoAlpha3,
      geography.status,
    ]),
  ].filter((value): value is string => Boolean(value));
}

type IndexedRopEntry = Readonly<{
  entry: RopCodeEntry;
  normalizedValues: readonly string[];
  documentTerms: ReadonlySet<string>;
}>;

const entrySearchIndexes = new WeakMap<RopCodeResource, readonly IndexedRopEntry[]>();

function getEntrySearchIndex(resource: RopCodeResource) {
  const existing = entrySearchIndexes.get(resource);
  if (existing) return existing;
  const created = resource.entries.map((entry) => {
    const values = entryValues(resource, entry);
    return {
      entry,
      normalizedValues: values.map(normalize),
      documentTerms: terms(values.join(" ")),
    } satisfies IndexedRopEntry;
  });
  entrySearchIndexes.set(resource, created);
  return created;
}

export function searchPrivateDataChatRopEntries(input: {
  resource: RopCodeResource;
  query: string;
  limit?: number;
}) {
  const query = normalize(input.query);
  if (!query) return [];
  const queryTerms = terms(query);
  if (queryTerms.size === 0) return [];
  return getEntrySearchIndex(input.resource)
    .map(({ entry, normalizedValues, documentTerms }) => {
      const exact = normalizedValues.some((value) => value === query);
      const phrase = normalizedValues.some((value) => value.includes(query));
      const matches = [...queryTerms].filter((term) => documentTerms.has(term)).length;
      const coverage = matches / Math.max(1, queryTerms.size);
      return {
        entry,
        score: (exact ? 10_000 : 0) + (phrase ? 1_000 : 0) + matches * 10 + coverage,
        exact,
      };
    })
    .filter((candidate) => candidate.exact || candidate.score >= 11)
    .sort(
      (left, right) =>
        Number(right.exact) - Number(left.exact) ||
        right.score - left.score ||
        left.entry.id.localeCompare(right.entry.id),
    )
    .slice(0, Math.max(1, Math.min(input.limit ?? 6, 25)));
}

type RopBenchmarkCase = Readonly<{
  id: string;
  category: string;
  query: string;
  relevantIds: readonly string[];
  exactCritical: boolean;
  hardNegative: boolean;
}>;

function relevantByValue(resource: RopCodeResource, value: string) {
  const query = normalize(value);
  return getEntrySearchIndex(resource)
    .filter(({ normalizedValues }) => normalizedValues.includes(query))
    .map(({ entry }) => entry.id);
}

export function buildPrivateDataChatRopEntryBenchmarkCases(
  resource: RopCodeResource,
) {
  const ordinary = resource.entries.find(
    (entry) => entry.rop3?.code && entry.rop3.name,
  )!;
  const withPlace = resource.entries.find((entry) => entry.place)!;
  const withLanguage = resource.entries.find((entry) => entry.language)!;
  const withSource = resource.entries.find((entry) => entry.source)!;
  const withIssue = resource.entries.find((entry) => entry.joinIssueLabel)!;
  const withGeography = resource.entries.find(
    (entry) => entry.rop3 && (resource.geoIndexByRop3[entry.rop3.code]?.length ?? 0) > 0,
  )!;
  const geography = resource.geoIndexByRop3[withGeography.rop3!.code]![0]!;
  const described = resource.entries.find(
    (entry) =>
      entry.rop3 &&
      Boolean(resource.rop3DetailsByCode[entry.rop3.code]?.description),
  );
  const candidates = [
    { id: "exact-rop3-code", category: "exact-code", value: ordinary.rop3!.code, exactCritical: true },
    { id: "exact-rop3-name", category: "exact-name", value: ordinary.rop3!.name!, exactCritical: true },
    { id: "exact-rop2-code", category: "hierarchy-code", value: ordinary.rop2!.code, exactCritical: true },
    { id: "exact-rop25-name", category: "hierarchy-name", value: ordinary.rop25!.name!, exactCritical: true },
    { id: "place", category: "place", value: withPlace.place!, exactCritical: false },
    { id: "language", category: "language", value: withLanguage.language!, exactCritical: false },
    { id: "source", category: "source", value: withSource.source!, exactCritical: false },
    { id: "join-issue", category: "join-issue", value: withIssue.joinIssueLabel!, exactCritical: false },
    { id: "geography-name", category: "geography", value: geography.geoName ?? geography.isoAlpha3 ?? geography.rog!, exactCritical: false },
    { id: "status", category: "status", value: "Active", exactCritical: false },
    ...(described
      ? [{
          id: "description",
          category: "description",
          value: resource.rop3DetailsByCode[described.rop3!.code]!.description!,
          exactCritical: false,
        }]
      : []),
  ];
  const cases: RopBenchmarkCase[] = candidates.map((candidate) => ({
    id: candidate.id,
    category: candidate.category,
    query: candidate.value,
    relevantIds: relevantByValue(resource, candidate.value),
    exactCritical: candidate.exactCritical,
    hardNegative: false,
  }));
  cases.push({
    id: "hard-negative",
    category: "hard-negative",
    query: "definitely-not-a-reviewed-rop-value-zzzzzz",
    relevantIds: [],
    exactCritical: false,
    hardNegative: true,
  });
  return cases;
}

export function runPrivateDataChatRopEntryBenchmark(input: {
  resource: RopCodeResource;
  repetitions?: number;
}) {
  const repetitions = input.repetitions ?? 3;
  const cases = buildPrivateDataChatRopEntryBenchmarkCases(input.resource);
  const results = cases.map((testCase) => {
    const runs = Array.from({ length: repetitions }, () => {
      const started = performance.now();
      const results = searchPrivateDataChatRopEntries({
        resource: input.resource,
        query: testCase.query,
      });
      return {
        ids: results.map((result) => result.entry.id),
        exact: results.map((result) => result.exact),
        latencyMs: performance.now() - started,
      };
    });
    const first = runs[0]!;
    const recallAt1 =
      testCase.relevantIds.length === 0
        ? first.ids.length === 0
          ? 1
          : 0
        : testCase.relevantIds.includes(first.ids[0] ?? "")
          ? 1
          : 0;
    const recallAt6 =
      testCase.relevantIds.length === 0
        ? recallAt1
        : first.ids.some((id) => testCase.relevantIds.includes(id))
          ? 1
          : 0;
    return {
      ...testCase,
      selectedIds: first.ids,
      recallAt1,
      recallAt6,
      latencyMs: Math.max(...runs.map((run) => run.latencyMs)),
      repeatable: new Set(runs.map((run) => JSON.stringify(run.ids))).size === 1,
    };
  });
  const exact = results.filter((result) => result.exactCritical);
  const latency = results.map((result) => result.latencyMs).sort((a, b) => a - b);
  const metrics = {
    caseCount: results.length,
    exactRecallAt1:
      exact.reduce((total, result) => total + result.recallAt1, 0) /
      Math.max(1, exact.length),
    recallAt6:
      results.reduce((total, result) => total + result.recallAt6, 0) /
      Math.max(1, results.length),
    hardNegativeAccuracy:
      results.filter((result) => result.hardNegative && result.selectedIds.length === 0)
        .length /
      Math.max(1, results.filter((result) => result.hardNegative).length),
    p95Ms: latency[Math.max(0, Math.ceil(latency.length * 0.95) - 1)] ?? 0,
    repeatable: results.every((result) => result.repeatable),
  };
  return {
    tier: "exact-lexical" as const,
    metrics,
    passed:
      metrics.exactRecallAt1 === 1 &&
      metrics.recallAt6 >= 0.95 &&
      metrics.hardNegativeAccuracy === 1 &&
      metrics.repeatable,
    cases: results,
  };
}
