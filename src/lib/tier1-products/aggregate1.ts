import {
  normalizeProductText,
  normalizeTier1SourceKey,
  numberToProductText,
  parseFiniteDecimal,
  truncateDecimal,
} from "./canonical";
import {
  AGGREGATE1_PERCENT_DECIMAL_PLACES,
  AGGREGATE1_PERCENT_FIELDS,
} from "./contracts";
import { buildTier1PriorityMap, selectFieldByPriority } from "./priority";
import { calculateWorkersNeeded } from "./merge";
import {
  TIER1_SOURCE_ORDER,
  type PipelineProductFinding,
  type PipelineProductResult,
  type Tier1PriorityRule,
  type Tier1ProductInputRow,
} from "./types";

const RESERVED_FIELDS = new Set([
  "PG_ROP3",
  "PG_Population",
  "Geo_Country_Name",
  "alt_countries",
  "Contributing_Sources",
  ...AGGREGATE1_PERCENT_FIELDS,
]);

function finding(input: Omit<PipelineProductFinding, "details"> & { details?: Record<string, unknown> }) {
  return { ...input, details: input.details ?? {} } satisfies PipelineProductFinding;
}

function parseSources(value: unknown) {
  return normalizeProductText(value)
    .split(";")
    .map(normalizeTier1SourceKey)
    .filter(Boolean);
}

function sourceRank(source: string) {
  const index = TIER1_SOURCE_ORDER.indexOf(source as (typeof TIER1_SOURCE_ORDER)[number]);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export function buildPgacAggregate1(input: {
  rows: readonly Readonly<Record<string, string>>[];
  priorities: readonly Tier1PriorityRule[];
}): PipelineProductResult {
  const findings: PipelineProductFinding[] = [];
  const groups = new Map<string, { row: Readonly<Record<string, string>>; index: number }[]>();
  input.rows.forEach((row, index) => {
    const rop3 = normalizeProductText(row.PG_ROP3);
    if (!rop3) {
      findings.push(finding({
        severity: "warning",
        ruleCode: "aggregate1-blank-rop3",
        message: "A specific people-group row with blank ROP3 cannot enter Aggregate 1.",
        sourceRowKey: String(index),
        fieldName: "PG_ROP3",
      }));
      return;
    }
    groups.set(rop3, [...(groups.get(rop3) ?? []), { row, index }]);
  });

  const priorityMap = buildTier1PriorityMap(input.priorities);
  const reportedFallbackFields = new Set<string>();
  const outputRows: Record<string, string>[] = [];
  for (const [rop3, group] of groups) {
    let populationTotal = 0;
    const populationByIndex = new Map<number, number>();
    for (const item of group) {
      const population = parseFiniteDecimal(item.row.PG_Population);
      if (population.value === null || population.value < 0) {
        findings.push(finding({
          severity: "warning",
          ruleCode: "aggregate1-invalid-population",
          message: "Invalid or negative population was excluded from Aggregate 1 sums.",
          sourceRowKey: String(item.index),
          fieldName: "PG_Population",
          details: { value: item.row.PG_Population ?? "" },
        }));
        populationByIndex.set(item.index, 0);
      } else {
        populationTotal += population.value;
        populationByIndex.set(item.index, population.value);
      }
    }

    const rankedCountries = group
      .map((item) => ({
        country: normalizeProductText(item.row.Geo_Country_Name),
        population: populationByIndex.get(item.index) ?? 0,
        index: item.index,
      }))
      .filter((item) => item.country)
      .sort((left, right) => right.population - left.population || left.index - right.index);
    const primaryCountry = rankedCountries[0]?.country ?? "";
    const alternateCountries = [...new Set(rankedCountries.map((item) => item.country).filter((country) => country !== primaryCountry))].sort();

    const contributorKeys = [...new Set(group.flatMap((item) => parseSources(item.row.Contributing_Sources)))]
      .sort((left, right) => sourceRank(left) - sourceRank(right) || left.localeCompare(right));
    const output: Record<string, string> = {
      PG_ROP3: rop3,
      PG_Population: numberToProductText(populationTotal),
      Geo_Country_Name: primaryCountry,
      alt_countries: alternateCountries.join("; "),
      Geo_Count_of_Countries: String(new Set(rankedCountries.map((item) => item.country)).size),
      Contributing_Sources: contributorKeys.map((source) => source.toUpperCase()).join("; "),
    };
    for (const source of TIER1_SOURCE_ORDER) {
      output[`${source === "etno" ? "ETNO" : source.toUpperCase()}_Source`] = contributorKeys.includes(source) ? "true" : "false";
    }
    output.Joint = TIER1_SOURCE_ORDER.every((source) => contributorKeys.includes(source)) ? "true" : "false";

    for (const field of AGGREGATE1_PERCENT_FIELDS) {
      let numerator = 0;
      for (const item of group) {
        const percent = parseFiniteDecimal(item.row[field]);
        if (percent.invalid) {
          findings.push(finding({
            severity: "warning",
            ruleCode: "aggregate1-invalid-percent",
            message: `${field} was invalid and contributed zero to the weighted numerator.`,
            sourceRowKey: String(item.index),
            fieldName: field,
          }));
        }
        numerator += (populationByIndex.get(item.index) ?? 0) * (percent.value ?? 0);
      }
      output[field] = populationTotal === 0
        ? ""
        : numberToProductText(
            truncateDecimal(numerator / populationTotal, AGGREGATE1_PERCENT_DECIMAL_PLACES),
          );
    }

    const universe = [...new Set(group.flatMap((item) => Object.keys(item.row)))]
      .filter((field) => !RESERVED_FIELDS.has(field) && !field.startsWith("src__") && !field.endsWith("_Source") && field !== "Joint")
      .sort();
    const selectionRows: Tier1ProductInputRow[] = group.map((item) => ({
      sourceKey: normalizeTier1SourceKey(item.row[`src__${universe[0]}`]) || parseSources(item.row.Contributing_Sources)[0] || "unknown",
      sourceLabel: "",
      stableRowKey: String(item.index),
      row: item.row,
    }));
    for (const field of universe) {
      const perFieldRows = selectionRows.map((item, index) => ({
        ...item,
        sourceKey: normalizeTier1SourceKey(group[index].row[`src__${field}`]) || item.sourceKey,
        sourceLabel: normalizeProductText(group[index].row[`src__${field}`]) || item.sourceKey.toUpperCase(),
      }));
      const selection = selectFieldByPriority({ groupKey: rop3, field, rows: perFieldRows, priorityMap });
      if (!selection) continue;
      if (selection.finding) {
        const isRepeatedFallback = selection.finding.ruleCode === "priority-fallback-used"
          && reportedFallbackFields.has(field);
        if (!isRepeatedFallback) findings.push(selection.finding);
        if (selection.finding.ruleCode === "priority-fallback-used") {
          reportedFallbackFields.add(field);
        }
      }
      if (selection.finding?.severity === "error") continue;
      output[field] = selection.value;
      if (["Christianity_Frontier_Group", "Christianity_GSEC"].includes(field)) {
        output[`src__${field}`] = selection.sourceLabel;
      }
    }

    output.Percent_Evangelical_PGAC = output.Christianity_Percent_Evangelical;
    const workers = calculateWorkersNeeded(output.PG_Population);
    output.Needs_Workers_Needed = workers.value;
    if (workers.finding) findings.push({ ...workers.finding, sourceRowKey: rop3 });
    outputRows.push(output);
  }

  outputRows.sort((left, right) => left.PG_ROP3.localeCompare(right.PG_ROP3));
  return {
    rows: outputRows,
    findings,
    warningCount: findings.filter((item) => item.severity === "warning").length,
    errorCount: findings.filter((item) => item.severity === "error").length,
    inputRowCount: input.rows.length,
    outputRowCount: outputRows.length,
  };
}
