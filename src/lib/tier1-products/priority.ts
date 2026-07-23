import { normalizeProductText, normalizeTier1SourceKey } from "./canonical";
import {
  TIER1_SOURCE_ORDER,
  type FieldSelection,
  type PipelineProductFinding,
  type Tier1PriorityRule,
  type Tier1ProductInputRow,
} from "./types";

export const DEFAULT_TIER1_PRIORITY = [...TIER1_SOURCE_ORDER] as const;

export function buildTier1PriorityMap(rules: readonly Tier1PriorityRule[]) {
  const priorities = new Map<string, readonly string[]>();
  for (const rule of rules) {
    const field = normalizeProductText(rule.canonicalField);
    if (!field) continue;
    const seen = new Set<string>();
    const order = rule.prioritySourceKeys
      .map(normalizeTier1SourceKey)
      .filter((source) => source && !seen.has(source) && Boolean(seen.add(source)));
    if (order.length > 0) priorities.set(field, order);
  }
  return priorities;
}

function finding(input: Omit<PipelineProductFinding, "details"> & { details?: Record<string, unknown> }) {
  return { ...input, details: input.details ?? {} } satisfies PipelineProductFinding;
}

export function selectFieldByPriority(input: {
  groupKey: string;
  field: string;
  rows: readonly Tier1ProductInputRow[];
  priorityMap: ReadonlyMap<string, readonly string[]>;
}): FieldSelection | null {
  const configuredOrder = input.priorityMap.get(input.field);
  const order = configuredOrder ?? DEFAULT_TIER1_PRIORITY;
  const rank = new Map(order.map((source, index) => [normalizeTier1SourceKey(source), index]));
  const candidates = input.rows
    .map((row) => ({
      value: normalizeProductText(row.row[input.field]),
      sourceKey: normalizeTier1SourceKey(row.sourceKey),
      sourceLabel: normalizeProductText(row.sourceLabel) || normalizeTier1SourceKey(row.sourceKey).toUpperCase(),
      stableRowKey: row.stableRowKey,
    }))
    .filter((candidate) => candidate.value)
    .sort((left, right) => {
      const rankDiff = (rank.get(left.sourceKey) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.sourceKey) ?? Number.MAX_SAFE_INTEGER);
      return rankDiff || left.sourceKey.localeCompare(right.sourceKey) || left.stableRowKey.localeCompare(right.stableRowKey);
    });

  if (candidates.length === 0) return null;

  const bestRank = rank.get(candidates[0].sourceKey) ?? Number.MAX_SAFE_INTEGER;
  const topCandidates = candidates.filter(
    (candidate) => (rank.get(candidate.sourceKey) ?? Number.MAX_SAFE_INTEGER) === bestRank,
  );
  const distinctTopValues = [...new Set(topCandidates.map((candidate) => candidate.value))];
  if (distinctTopValues.length > 1) {
    return {
      value: "",
      sourceKey: "",
      sourceLabel: "",
      usedFallback: !configuredOrder,
      finding: finding({
        severity: "error",
        ruleCode: "equal-priority-conflict",
        message: `${input.field} has conflicting nonblank values at the highest priority for ${input.groupKey}.`,
        sourceRowKey: input.groupKey,
        fieldName: input.field,
        details: {
          values: distinctTopValues.sort(),
          sources: [...new Set(topCandidates.map((candidate) => candidate.sourceKey))].sort(),
        },
      }),
    };
  }

  const winner = topCandidates[0];
  return {
    value: winner.value,
    sourceKey: winner.sourceKey,
    sourceLabel: winner.sourceLabel,
    usedFallback: !configuredOrder,
    finding: configuredOrder
      ? null
      : finding({
          severity: "warning",
          ruleCode: "priority-fallback-used",
          message: `${input.field} used the JP, IMB, AX, ETNO, WCD fallback; winner ${winner.sourceLabel}.`,
          sourceRowKey: input.groupKey,
          fieldName: input.field,
          details: { order: DEFAULT_TIER1_PRIORITY, winner: winner.sourceKey },
        }),
  };
}
