import {
  checksumProductValue,
  normalizeIso3,
  normalizeProductText,
  normalizeRop3,
  normalizeTier1SourceKey,
  parseFiniteDecimal,
} from "./canonical";
import {
  TIER1_ISO3_FIELD_KEYS,
  TIER1_PGIC_FIELD_KEYS,
  TIER1_ROP3_FIELD_KEYS,
  TIER1_WORKERS_POPULATION_PER_WORKER,
} from "./contracts";
import { buildTier1PriorityMap, selectFieldByPriority } from "./priority";
import {
  TIER1_SOURCE_ORDER,
  type PipelineProductFinding,
  type PipelineProductResult,
  type Tier1PriorityRule,
  type Tier1ProductInputRow,
} from "./types";

const EXCLUDED_FIELDS = new Set([
  ...TIER1_PGIC_FIELD_KEYS,
  ...TIER1_ROP3_FIELD_KEYS,
  ...TIER1_ISO3_FIELD_KEYS,
  "Data_Source",
  "Contributing_Sources",
]);

function readFirst(row: Readonly<Record<string, string>>, fields: readonly string[]) {
  for (const field of fields) {
    const value = normalizeProductText(row[field]);
    if (value) return value;
  }
  return "";
}

function finding(input: Omit<PipelineProductFinding, "details"> & { details?: Record<string, unknown> }) {
  return { ...input, details: input.details ?? {} } satisfies PipelineProductFinding;
}

function sourceRank(source: string) {
  const rank = TIER1_SOURCE_ORDER.indexOf(normalizeTier1SourceKey(source) as (typeof TIER1_SOURCE_ORDER)[number]);
  return rank < 0 ? Number.MAX_SAFE_INTEGER : rank;
}

function contributors(rows: readonly Tier1ProductInputRow[]) {
  return [...new Set(rows.map((row) => normalizeTier1SourceKey(row.sourceKey)).filter(Boolean))]
    .sort((left, right) => sourceRank(left) - sourceRank(right) || left.localeCompare(right))
    .map((source) => source.toUpperCase());
}

function fieldUniverse(rows: readonly Tier1ProductInputRow[]) {
  return [...new Set(rows.flatMap((row) => Object.keys(row.row)))]
    .filter((field) => !EXCLUDED_FIELDS.has(field) && !field.startsWith("src__"))
    .sort();
}

function withSummary(rows: Record<string, string>[], findings: PipelineProductFinding[], inputRowCount: number): PipelineProductResult {
  return {
    rows,
    findings,
    warningCount: findings.filter((item) => item.severity === "warning").length,
    errorCount: findings.filter((item) => item.severity === "error").length,
    inputRowCount,
    outputRowCount: rows.length,
  };
}

export function calculateWorkersNeeded(populationRaw: unknown) {
  const parsed = parseFiniteDecimal(populationRaw);
  if (parsed.value === null || parsed.value < 0) {
    return {
      value: "",
      finding: finding({
        severity: "warning",
        ruleCode: parsed.invalid ? "invalid-population-for-workers" : "missing-or-negative-population-for-workers",
        message: "Workers needed is blank because population is missing, invalid, or negative.",
        sourceRowKey: null,
        fieldName: "PG_Population",
        details: { population: normalizeProductText(populationRaw) },
      }),
    } as const;
  }
  return {
    value: String(Math.ceil(parsed.value / TIER1_WORKERS_POPULATION_PER_WORKER)),
    finding: null,
  } as const;
}

function mergeGroups(input: {
  rows: readonly Tier1ProductInputRow[];
  priorities: readonly Tier1PriorityRule[];
  keyKind: "pgic" | "specific";
}) {
  const findings: PipelineProductFinding[] = [];
  const groups = new Map<string, Tier1ProductInputRow[]>();
  const groupKeys = new Map<string, { pgic?: string; rop3?: string; iso3?: string }>();

  for (const inputRow of input.rows) {
    let key: string;
    if (input.keyKind === "pgic") {
      const pgic = readFirst(inputRow.row, TIER1_PGIC_FIELD_KEYS);
      if (!pgic) {
        key = `unmatched:${normalizeTier1SourceKey(inputRow.sourceKey)}:${inputRow.stableRowKey || checksumProductValue(inputRow.row)}`;
        findings.push(finding({
          severity: "error",
          ruleCode: "missing-canonical-pgic",
          message: "A canonical PGIC is required for the Tier 1 PGIC merge.",
          sourceRowKey: inputRow.stableRowKey,
          fieldName: "PG_AX_unique_PG_ID_PGIC",
        }));
      } else {
        key = `pgic:${pgic}`;
        groupKeys.set(key, { pgic });
      }
    } else {
      const rop3 = normalizeRop3(readFirst(inputRow.row, TIER1_ROP3_FIELD_KEYS));
      const iso3 = normalizeIso3(readFirst(inputRow.row, TIER1_ISO3_FIELD_KEYS));
      if (!rop3 || !iso3) {
        key = `unmatched:${normalizeTier1SourceKey(inputRow.sourceKey)}:${inputRow.stableRowKey || checksumProductValue(inputRow.row)}`;
        findings.push(finding({
          severity: "warning",
          ruleCode: "incomplete-specific-pg-key",
          message: "The row remains independently unmerged because ROP3 or ISO3 is blank.",
          sourceRowKey: inputRow.stableRowKey,
          fieldName: !rop3 ? "PG_ROP3" : "Geo_ISO3",
          details: { rop3, iso3 },
        }));
      } else {
        key = `specific:${rop3}:${iso3}`;
        groupKeys.set(key, { rop3, iso3 });
      }
    }
    groups.set(key, [...(groups.get(key) ?? []), inputRow]);
  }

  const priorityMap = buildTier1PriorityMap(input.priorities);
  const reportedFallbackFields = new Set<string>();
  const outputRows: Record<string, string>[] = [];
  for (const [key, rawGroup] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const group = [...rawGroup].sort(
      (left, right) => sourceRank(left.sourceKey) - sourceRank(right.sourceKey)
        || left.stableRowKey.localeCompare(right.stableRowKey),
    );
    const seenSource = new Set<string>();
    let blocking = false;
    for (const row of group) {
      const source = normalizeTier1SourceKey(row.sourceKey);
      if (seenSource.has(source)) {
        findings.push(finding({
          severity: "error",
          ruleCode: "duplicate-source-binding",
          message: `${source.toUpperCase()} contributes more than one row to ${key}.`,
          sourceRowKey: row.stableRowKey,
          fieldName: null,
          details: { groupKey: key, source },
        }));
        blocking = true;
      }
      seenSource.add(source);
    }

    const keyValues = groupKeys.get(key) ?? {};
    const output: Record<string, string> = {
      ...(keyValues.pgic ? { PG_AX_unique_PG_ID_PGIC: keyValues.pgic } : {}),
      ...(keyValues.rop3 ? { PG_ROP3: keyValues.rop3 } : {}),
      ...(keyValues.iso3 ? { Geo_ISO3: keyValues.iso3 } : {}),
      Contributing_Sources: contributors(group).join("; "),
    };

    for (const field of fieldUniverse(group)) {
      const selection = selectFieldByPriority({ groupKey: key, field, rows: group, priorityMap });
      if (!selection) continue;
      if (selection.finding) {
        const isRepeatedFallback = selection.finding.ruleCode === "priority-fallback-used"
          && reportedFallbackFields.has(field);
        if (!isRepeatedFallback) findings.push(selection.finding);
        if (selection.finding.ruleCode === "priority-fallback-used") {
          reportedFallbackFields.add(field);
        }
        if (selection.finding.severity === "error") blocking = true;
      }
      if (selection.value) {
        output[field] = selection.value;
        output[`src__${field}`] = selection.sourceLabel;
      }
    }

    const workers = calculateWorkersNeeded(output.PG_Population);
    output.Needs_Workers_Needed = workers.value;
    if (workers.finding) {
      findings.push({ ...workers.finding, sourceRowKey: key });
    }
    if (!blocking) outputRows.push(output);
  }

  return withSummary(outputRows, findings, input.rows.length);
}

export function mergeTier1ByCanonicalPgic(input: {
  rows: readonly Tier1ProductInputRow[];
  priorities: readonly Tier1PriorityRule[];
}) {
  return mergeGroups({ ...input, keyKind: "pgic" });
}

export function mergeTier1SpecificPeopleGroups(input: {
  rows: readonly Tier1ProductInputRow[];
  priorities: readonly Tier1PriorityRule[];
}) {
  return mergeGroups({ ...input, keyKind: "specific" });
}

export function applyWorkersNeeded(rows: readonly Readonly<Record<string, string>>[]) {
  const findings: PipelineProductFinding[] = [];
  const outputRows = rows.map((sourceRow, index) => {
    const output = { ...sourceRow };
    const workers = calculateWorkersNeeded(output.PG_Population);
    output.Needs_Workers_Needed = workers.value;
    if (workers.finding) findings.push({ ...workers.finding, sourceRowKey: String(index) });
    return output;
  });
  return withSummary(outputRows, findings, rows.length);
}
