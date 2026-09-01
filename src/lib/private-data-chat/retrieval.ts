import {
  getActivePrivateDataChatSemanticContext,
} from "@/lib/private-data-chat/semantic-context-candidate";
import type {
  PrivateDataChatSemanticCard,
  PrivateDataChatSemanticContextPackage,
} from "@/lib/private-data-chat/semantic-context";
import { searchSemanticContextCards } from "@/lib/reference-resources";
import {
  PRIVATE_DATA_CHAT_RETRIEVAL_MAX_BYTES,
  PRIVATE_DATA_CHAT_RETRIEVAL_MAX_DEMONSTRATIONS,
  PRIVATE_DATA_CHAT_RETRIEVAL_MAX_ITEMS,
  PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_CHECKSUM,
  PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION,
} from "@/lib/private-data-chat/retrieval-policy";

export {
  PRIVATE_DATA_CHAT_RETRIEVAL_MAX_BYTES,
  PRIVATE_DATA_CHAT_RETRIEVAL_MAX_DEMONSTRATIONS,
  PRIVATE_DATA_CHAT_RETRIEVAL_MAX_ITEMS,
  PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_CHECKSUM,
  PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION,
} from "@/lib/private-data-chat/retrieval-policy";

export type PrivateDataChatRetrievalAudience = "planner" | "answer";

export type PrivateDataChatRetrievalAudit = Readonly<{
  audience: PrivateDataChatRetrievalAudience;
  semanticSnapshotChecksum: string;
  retrievalPolicyChecksum: string;
  retrievalTier: "exact-postgres-lexical";
  selectedCardKeys: readonly string[];
  selectedCardChecksums: readonly string[];
  contextBytes: number;
  latencyMs: number;
}>;

export type PrivateDataChatControlledRetrievalView = Readonly<{
  source: "utterance" | "current-view" | "prior-turn";
  text: string;
  stableKey: string | null;
}>;

export type PrivateDataChatRetrievedItem = Readonly<{
  stableKey: string;
  kind: PrivateDataChatSemanticCard["kind"];
  label: string;
  definition: string;
  aliases: readonly string[];
  grain: string;
  valueType: PrivateDataChatSemanticCard["valueType"];
  unit: string | null;
  nullMeaning: string | null;
  allowedValuePolicy: string | null;
  formula: string | null;
  dependencies: readonly string[];
  relationships: readonly string[];
  resourceOperations: readonly string[];
  examples: readonly string[];
  counterexamples: readonly string[];
  queryAuthority: PrivateDataChatSemanticCard["queryAuthority"];
  contentChecksum: string;
}>;

type RankedCard = Readonly<{
  card: PrivateDataChatSemanticCard;
  score: number;
  exact: boolean;
  pinned: boolean;
}>;

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function tokens(value: string) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 1));
}

function eligible(card: PrivateDataChatSemanticCard, audience: PrivateDataChatRetrievalAudience) {
  return (
    card.sensitivity === "private-internal" &&
    card.queryAuthority !== "excluded" &&
    card.audiences.includes(audience)
  );
}

function exactPhrases(card: PrivateDataChatSemanticCard) {
  return [card.stableKey, card.label, ...card.aliases]
    .map(normalize)
    .filter((value) => value.length >= 3);
}

function isExactMatch(card: PrivateDataChatSemanticCard, query: string) {
  const normalizedQuery = ` ${normalize(query)} `;
  return exactPhrases(card).some(
    (phrase) => normalizedQuery === ` ${phrase} ` || normalizedQuery.includes(` ${phrase} `),
  );
}

function lexicalScore(card: PrivateDataChatSemanticCard, query: string) {
  const queryTokens = tokens(query);
  if (queryTokens.size === 0) return 0;
  const labelTokens = tokens([card.label, ...card.aliases].join(" "));
  const bodyTokens = tokens(
    [card.definition, card.contextualSearchText, ...card.retrievalTags].join(" "),
  );
  let labelMatches = 0;
  let bodyMatches = 0;
  for (const token of queryTokens) {
    if (labelTokens.has(token)) labelMatches += 1;
    if (bodyTokens.has(token)) bodyMatches += 1;
  }
  return labelMatches * 4 + bodyMatches + (labelMatches + bodyMatches) / queryTokens.size;
}

function intentBoost(card: PrivateDataChatSemanticCard, query: string) {
  const text = normalize(query);
  const mentionsRop = /\b(?:rop(?:1|2|25|3)?|registry of peoples|classification|classifications)\b/u.test(text);
  let score = 0;
  if (
    card.stableKey === "metric.people_group_count" &&
    /\b(?:how many|count|number of)\b/u.test(text)
  ) score += 9_000;
  if (
    card.stableKey === "field.country" &&
    !mentionsRop &&
    /\b(?:country|nation|in)\b/u.test(text)
  ) score += 8_000;
  if (card.stableKey === "resource.rop_codes" && mentionsRop) score += 8_000;
  if (
    card.stableKey === "resolver.rop_name" &&
    mentionsRop &&
    /\b(?:named|name|term|ambiguous|classification)\b/u.test(text)
  ) score += 9_000;
  if (
    card.stableKey === "relationship.people_group_to_bound_rop3" &&
    mentionsRop &&
    /\b(?:bound|belongs|relationship|join|classif|version|catalog|today|dataset)/u.test(text)
  ) score += 9_500;
  if (
    card.stableKey === "field.rop2_code" &&
    mentionsRop &&
    /\b(?:rop2|classified|under|term)\b/u.test(text)
  ) score += 9_750;
  if (
    card.stableKey === "lineage.rop_bound_version" &&
    mentionsRop &&
    /\b(?:bound|belongs|version|catalog|today|dataset)\b/u.test(text)
  ) score += 9_000;
  if (
    card.stableKey === "operation.rop_geography_exists" &&
    mentionsRop &&
    /\b(?:geography|geographic)\b/u.test(text) &&
    /\b(?:filter|find|includes|matching|without|duplicate)\b/u.test(text)
  ) score += 9_500;
  if (
    card.stableKey === "grain.rop_geography" &&
    mentionsRop &&
    /\b(?:geography|geographic)\b/u.test(text) &&
    /\b(?:list|show|each|records|attached)\b/u.test(text)
  ) score += 9_500;
  const operationPatterns: Readonly<Record<string, RegExp>> = {
    "operation.rop_lookup": /\b(?:look up|lookup|definition|exact code)\b/u,
    "operation.rop_list": /\b(?:browse|list|all entries|page)\b/u,
    "operation.rop_continue": /\b(?:continue|next page|show more)\b/u,
    "operation.rop_count": /\b(?:count|how many)\b/u,
    "operation.rop_search": /\b(?:search|find)\b/u,
  };
  if (mentionsRop && operationPatterns[card.stableKey]?.test(text)) score += 9_500;
  if (
    card.stableKey === "result.matched_count" &&
    /\b(?:rows?|records?|results?|returned|showing|100|103)\b/u.test(text) &&
    /\b(?:match|matches|total|103)\b/u.test(text)
  ) score += 9_000;
  if (
    card.stableKey === "result.returned_count" &&
    /\b(?:show|shown|return|returned|page|limit|100)\b/u.test(text)
  ) score += 9_500;
  return score;
}

function dataOnlyItem(card: PrivateDataChatSemanticCard): PrivateDataChatRetrievedItem {
  return {
    stableKey: card.stableKey,
    kind: card.kind,
    label: card.label,
    definition: card.definition,
    aliases: card.aliases,
    grain: card.grain,
    valueType: card.valueType,
    unit: card.unit,
    nullMeaning: card.nullMeaning,
    allowedValuePolicy: card.allowedValuePolicy,
    formula: card.formula,
    dependencies: card.dependencies,
    relationships: card.relationships,
    resourceOperations: card.resourceOperations,
    examples: card.examples,
    counterexamples: card.counterexamples,
    queryAuthority: card.queryAuthority,
    contentChecksum: card.contentChecksum,
  };
}

function serializedItems(items: readonly PrivateDataChatRetrievedItem[]) {
  return JSON.stringify({
    type: "reviewed-semantic-evidence",
    policyVersion: PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION,
    instructionAuthority: false,
    items,
  });
}

export function buildPrivateDataChatControlledRetrievalViews(input: {
  utterance: string;
  cards: readonly PrivateDataChatSemanticCard[];
  verifiedCurrentViewKeys?: readonly string[];
  verifiedPriorTurnKeys?: readonly string[];
}) {
  const byKey = new Map(input.cards.map((card) => [card.stableKey, card]));
  const views: PrivateDataChatControlledRetrievalView[] = [
    { source: "utterance", text: input.utterance, stableKey: null },
  ];
  for (const [source, keys] of [
    ["current-view", input.verifiedCurrentViewKeys ?? []],
    ["prior-turn", input.verifiedPriorTurnKeys ?? []],
  ] as const) {
    for (const key of [...new Set(keys)].sort()) {
      const card = byKey.get(key);
      if (!card) continue;
      views.push({ source, text: `${card.label} ${card.stableKey}`, stableKey: key });
    }
  }
  return views;
}

export async function retrievePrivateDataChatSemanticContext(
  input: {
    utterance: string;
    audience: PrivateDataChatRetrievalAudience;
    verifiedCurrentViewKeys?: readonly string[];
    verifiedPriorTurnKeys?: readonly string[];
    requiredKeys?: readonly string[];
    expectedSnapshotChecksum?: string;
    snapshotChecksum?: string;
    package?: PrivateDataChatSemanticContextPackage;
    lexicalCandidates?: readonly Readonly<{
      card: PrivateDataChatSemanticCard;
      score: number;
    }>[];
  },
  dependencies: {
    loadActive?: typeof getActivePrivateDataChatSemanticContext;
    searchLexical?: typeof searchSemanticContextCards;
  } = {},
) {
  const loadActive = dependencies.loadActive ?? getActivePrivateDataChatSemanticContext;
  const active = input.package ? null : await loadActive();
  const semanticPackage = input.package ?? active!.payload;
  const snapshotChecksum =
    active?.version.contentChecksum ??
    input.snapshotChecksum ??
    semanticPackage.definitionPackageChecksum;
  if (
    input.expectedSnapshotChecksum &&
    input.expectedSnapshotChecksum !== snapshotChecksum
  ) {
    return {
      status: "unavailable" as const,
      reason: "semantic-snapshot-stale" as const,
      missingKeys: [] as string[],
    };
  }

  const normalizedUtterance = normalize(input.utterance);
  const requiredInputKeys = new Set(input.requiredKeys ?? []);
  const mentionsRop = /\b(?:rop(?:1|2|25|3)?|registry of peoples|classification|classifications)\b/u.test(
    normalizedUtterance,
  );
  const mentionsUupg = /\b(?:uupg|unengaged|unreached|frontier|global engagement)\b/u.test(
    normalizedUtterance,
  );
  const cards = semanticPackage.entries.filter((card) => {
    if (!eligible(card, input.audience)) return false;
    if (requiredInputKeys.has(card.stableKey)) return true;
    if (
      (card.stableKey.startsWith("operation.rop_") ||
        card.stableKey.startsWith("resource.rop_") ||
        card.stableKey.startsWith("resolver.rop_") ||
        card.stableKey.startsWith("lineage.rop_") ||
        card.stableKey.startsWith("relationship.people_group_to_bound_rop3") ||
        card.stableKey.startsWith("grain.rop_geography") ||
        card.stableKey.startsWith("field.rop")) &&
      !mentionsRop
    ) return false;
    if (
      (card.stableKey === "filter.uupg" ||
        card.stableKey === "field.globally_engaged" ||
        card.stableKey === "field.frontier_group") &&
      !mentionsUupg
    ) return false;
    return true;
  });
  const byKey = new Map(cards.map((card) => [card.stableKey, card]));
  const views = buildPrivateDataChatControlledRetrievalViews({
    utterance: input.utterance,
    cards,
    verifiedCurrentViewKeys: input.verifiedCurrentViewKeys,
    verifiedPriorTurnKeys: input.verifiedPriorTurnKeys,
  });
  const pinnedKeys = new Set(
    views.flatMap((view) => (view.stableKey ? [view.stableKey] : [])),
  );
  for (const key of input.requiredKeys ?? []) pinnedKeys.add(key);
  const hasDomainAnchor =
    pinnedKeys.size > 0 ||
    /\b(?:people groups?|dataset|population|country|nation|gsec|frontier|engagement|evangelical|uupg|unengaged|unreached|rop(?:1|2|25|3)?|registry of peoples|classifications?|analytics|data query|current view|returned|show|showing|rows?|records?|results?|page)\b/u.test(
      normalizedUtterance,
    );
  if (!hasDomainAnchor) {
    return {
      status: "clarify" as const,
      reason: "semantic-retrieval-low-confidence" as const,
      missingKeys: [],
      views,
    };
  }

  const lexical = input.lexicalCandidates
    ? [...input.lexicalCandidates]
    : input.package
      ? cards.map((card) => ({ card, score: lexicalScore(card, input.utterance) }))
      : await (dependencies.searchLexical ?? searchSemanticContextCards)({
          query: input.utterance,
          audience: input.audience,
          limit: 30,
          versionId: active!.version.id,
        });
  const rankedByKey = new Map<string, RankedCard>();
  for (const card of cards) {
    const exact = isExactMatch(card, input.utterance);
    const pinned = pinnedKeys.has(card.stableKey);
    const lexicalResult = lexical.find(
      (candidate) => candidate.card.stableKey === card.stableKey,
    );
    const score =
      (exact ? 10_000 : 0) +
      (pinned ? 20_000 : 0) +
      intentBoost(card, input.utterance) +
      (lexicalResult?.score ?? 0);
    if (score > 0) rankedByKey.set(card.stableKey, { card, score, exact, pinned });
  }

  const missingKeys = [...pinnedKeys].filter((key) => !byKey.has(key));
  if (missingKeys.length > 0) {
    return {
      status: "clarify" as const,
      reason: "required-semantic-evidence-unavailable" as const,
      missingKeys: missingKeys.sort(),
      views,
    };
  }

  const initial = [...rankedByKey.values()].sort(
    (left, right) =>
      Number(right.pinned) - Number(left.pinned) ||
      Number(right.exact) - Number(left.exact) ||
      right.score - left.score ||
      left.card.stableKey.localeCompare(right.card.stableKey),
  );
  if (
    initial.length === 0 ||
    (!initial[0]!.exact && !initial[0]!.pinned && initial[0]!.score < 5)
  ) {
    return {
      status: "clarify" as const,
      reason: "semantic-retrieval-low-confidence" as const,
      missingKeys: [],
      views,
    };
  }

  const expanded: RankedCard[] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();
  const addWithDependencies = (candidate: RankedCard) => {
    if (seen.has(candidate.card.stableKey)) return true;
    if (visiting.has(candidate.card.stableKey)) return false;
    visiting.add(candidate.card.stableKey);
    seen.add(candidate.card.stableKey);
    expanded.push(candidate);
    const dependenciesToAdd: RankedCard[] = [];
    for (const dependencyKey of candidate.card.dependencies) {
      const dependency = byKey.get(dependencyKey);
      if (!dependency) {
        seen.delete(candidate.card.stableKey);
        expanded.pop();
        visiting.delete(candidate.card.stableKey);
        return false;
      }
      dependenciesToAdd.push({
        card: dependency,
        score: candidate.score,
        exact: false,
        pinned: candidate.pinned,
      });
    }
    for (const dependency of dependenciesToAdd) {
      if (!addWithDependencies(dependency)) {
        visiting.delete(candidate.card.stableKey);
        return false;
      }
    }
    visiting.delete(candidate.card.stableKey);
    return true;
  };

  const unresolved: string[] = [];
  for (const candidate of initial) {
    if (expanded.length >= PRIVATE_DATA_CHAT_RETRIEVAL_MAX_ITEMS) break;
    if (!addWithDependencies(candidate) && candidate.pinned) {
      unresolved.push(candidate.card.stableKey);
    }
  }
  if (unresolved.length > 0) {
    return {
      status: "clarify" as const,
      reason: "semantic-dependency-incomplete" as const,
      missingKeys: unresolved.sort(),
      views,
    };
  }

  const selected: RankedCard[] = [];
  let demonstrations = 0;
  for (const candidate of expanded) {
    if (selected.length >= PRIVATE_DATA_CHAT_RETRIEVAL_MAX_ITEMS) break;
    if (candidate.card.kind === "demonstration") {
      if (demonstrations >= PRIVATE_DATA_CHAT_RETRIEVAL_MAX_DEMONSTRATIONS) continue;
      const trainOnly = candidate.card.sourceReferences.some(
        (source) =>
          source.sourceKey === "semantic-evaluation-corpus" &&
          source.freshness === "grouped train partition",
      );
      if (!trainOnly) continue;
      demonstrations += 1;
    }
    const next = [...selected, candidate];
    const bytes = new TextEncoder().encode(
      serializedItems(next.map((item) => dataOnlyItem(item.card))),
    ).byteLength;
    if (bytes > PRIVATE_DATA_CHAT_RETRIEVAL_MAX_BYTES) {
      if (candidate.pinned) {
        return {
          status: "clarify" as const,
          reason: "semantic-context-budget-exceeded" as const,
          missingKeys: [candidate.card.stableKey],
          views,
        };
      }
      continue;
    }
    selected.push(candidate);
  }

  const selectedKeys = new Set(selected.map((candidate) => candidate.card.stableKey));
  if (selected.length === 0) {
    return {
      status: "clarify" as const,
      reason: "semantic-retrieval-low-confidence" as const,
      missingKeys: [],
      views,
    };
  }
  const uncoveredPinned = [...pinnedKeys].filter((key) => !selectedKeys.has(key));
  if (uncoveredPinned.length > 0) {
    return {
      status: "clarify" as const,
      reason: "required-semantic-evidence-does-not-fit" as const,
      missingKeys: uncoveredPinned.sort(),
      views,
    };
  }

  const items = selected.map((candidate) => dataOnlyItem(candidate.card));
  const serialized = serializedItems(items);
  return {
    status: "ready" as const,
    snapshotChecksum,
    definitionPackageChecksum: semanticPackage.definitionPackageChecksum,
    policyVersion: PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION,
    policyChecksum: PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_CHECKSUM,
    views,
    items,
    serialized,
    bytes: new TextEncoder().encode(serialized).byteLength,
    exactKeys: selected.filter((candidate) => candidate.exact).map((candidate) => candidate.card.stableKey),
  };
}

export type PrivateDataChatRetrievalReady = Extract<
  Awaited<ReturnType<typeof retrievePrivateDataChatSemanticContext>>,
  { status: "ready" }
>;

export function buildPrivateDataChatRetrievalAudit(input: {
  audience: PrivateDataChatRetrievalAudience;
  retrieval: PrivateDataChatRetrievalReady;
  latencyMs: number;
}): PrivateDataChatRetrievalAudit {
  return {
    audience: input.audience,
    semanticSnapshotChecksum: input.retrieval.snapshotChecksum,
    retrievalPolicyChecksum: input.retrieval.policyChecksum,
    retrievalTier: "exact-postgres-lexical",
    selectedCardKeys: input.retrieval.items.map((item) => item.stableKey),
    selectedCardChecksums: input.retrieval.items.map(
      (item) => item.contentChecksum,
    ),
    contextBytes: input.retrieval.bytes,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
  };
}
