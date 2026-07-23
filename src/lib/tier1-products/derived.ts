import {
  normalizeProductText,
  numberToProductText,
  parseBooleanValue,
  parseFiniteDecimal,
} from "./canonical";
import {
  HOTSPOT_COUNTRY_LIMIT,
  SELF_ENGAGED_THRESHOLDS,
  SOUTH_ASIA_SCOPE_V1,
  WATCHLIST_THRESHOLDS,
} from "./contracts";
import type {
  PipelineProductFinding,
  PipelineProductResult,
  SouthAsiaScopeContract,
} from "./types";

export { SOUTH_ASIA_SCOPE_V1 } from "./contracts";

function result(rows: Record<string, string>[], findings: PipelineProductFinding[], inputRowCount: number): PipelineProductResult {
  return {
    rows,
    findings,
    warningCount: findings.filter((item) => item.severity === "warning").length,
    errorCount: findings.filter((item) => item.severity === "error").length,
    inputRowCount,
    outputRowCount: rows.length,
  };
}

function classify(row: Readonly<Record<string, string>>) {
  const population = parseFiniteDecimal(row.PG_Population).value ?? 0;
  const percent = parseFiniteDecimal(row.Percent_Evangelical_PGAC).value ?? 0;
  const believers = population * (percent / 100);
  return { population, percent, believers };
}

export function buildSelfEngaged(rows: readonly Readonly<Record<string, string>>[]) {
  const output = rows.filter((row) => {
    const { percent, believers } = classify(row);
    const gsec = parseFiniteDecimal(row.Christianity_GSEC).value;
    const frontier = parseBooleanValue(row.Christianity_Frontier_Group);
    const phase = parseFiniteDecimal(row.Engage_8_Phases_of_Engagement).value;
    const axSource = parseBooleanValue(row.AX_Source);
    const phaseAvailable = Boolean(normalizeProductText(row.Engage_8_Phases_of_Engagement)) && axSource !== false;
    return gsec !== null && gsec <= SELF_ENGAGED_THRESHOLDS.gsecMaximum
      && frontier === false
      && believers >= SELF_ENGAGED_THRESHOLDS.believerMinimum
      && (percent >= SELF_ENGAGED_THRESHOLDS.evangelicalPercentMinimum
        || believers >= SELF_ENGAGED_THRESHOLDS.alternateBelieverMinimum)
      && ((phaseAvailable && phase !== null
        && phase >= SELF_ENGAGED_THRESHOLDS.engagementPhaseMinimum)
        || percent >= SELF_ENGAGED_THRESHOLDS.independentlyEngagedPercentMinimum);
  }).map((row) => ({ ...row, EV_Believers: numberToProductText(classify(row).believers), PGAC_Self_Engaged: "true" }));
  return result(output, [], rows.length);
}

export function buildWatchlist(rows: readonly Readonly<Record<string, string>>[]) {
  const output = rows.filter((row) => {
    const { percent, believers } = classify(row);
    const gsecSource = normalizeProductText(row.src__Christianity_GSEC).toUpperCase();
    const frontierSource = normalizeProductText(row.src__Christianity_Frontier_Group).toUpperCase();
    const gsec = parseFiniteDecimal(row.Christianity_GSEC).value;
    const frontier = parseBooleanValue(row.Christianity_Frontier_Group);
    const gsecPass = gsecSource !== "IMB"
      || (gsec !== null && gsec <= WATCHLIST_THRESHOLDS.imbGsecMaximum);
    const frontierPass = frontierSource !== "JP" || frontier === true;
    return gsecPass && frontierPass
      && believers < WATCHLIST_THRESHOLDS.believerMaximumExclusive
      && (percent < WATCHLIST_THRESHOLDS.evangelicalPercentMaximumExclusive
        || believers < WATCHLIST_THRESHOLDS.alternateBelieverMaximumExclusive)
      && percent < WATCHLIST_THRESHOLDS.evangelicalPercentHardMaximumExclusive;
  }).map((row) => ({ ...row, EV_Believers: numberToProductText(classify(row).believers), PGAC_Filter_Keep: "true" }));
  return result(output, [], rows.length);
}

export function buildBaselineUupg(rows: readonly Readonly<Record<string, string>>[]) {
  const output = rows.filter((row) => {
    const engagedAnywhere = parseBooleanValue(row.Engage_Global_Engagement_Anywhere);
    const frontierSource = normalizeProductText(row.src__Christianity_Frontier_Group).toUpperCase();
    const frontier = parseBooleanValue(row.Christianity_Frontier_Group);
    return engagedAnywhere === false && (frontierSource !== "JP" || frontier === true);
  }).map((row) => ({ ...row }));
  return result(output, [], rows.length);
}

export function buildHotspots(rows: readonly Readonly<Record<string, string>>[]) {
  const countryTotals = new Map<string, number>();
  for (const row of rows) {
    const country = normalizeProductText(row.Geo_Country_Name);
    const population = parseFiniteDecimal(row.PG_Population).value;
    if (!country || population === null || population < 0) continue;
    countryTotals.set(country, (countryTotals.get(country) ?? 0) + population);
  }
  const top = [...countryTotals.entries()]
    .sort(([leftCountry, leftTotal], [rightCountry, rightTotal]) => rightTotal - leftTotal || leftCountry.localeCompare(rightCountry))
    .slice(0, HOTSPOT_COUNTRY_LIMIT);
  const ranks = new Map(top.map(([country, total], index) => [country, { rank: index + 1, total }]));
  const output = rows
    .filter((row) => ranks.has(normalizeProductText(row.Geo_Country_Name)))
    .map((row) => {
      const rank = ranks.get(normalizeProductText(row.Geo_Country_Name))!;
      return {
        ...row,
        Primary_Country_PG_Population_Total: numberToProductText(rank.total),
        Primary_Country_Hotspot_Rank: String(rank.rank),
        Primary_Country_Is_Hotspot: "true",
      };
    })
    .sort((left, right) => Number(left.Primary_Country_Hotspot_Rank) - Number(right.Primary_Country_Hotspot_Rank));
  return result(output, [], rows.length);
}

function normalizeCountry(value: string, scope: SouthAsiaScopeContract) {
  const normalized = normalizeProductText(value)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
  return scope.aliases[normalized] ?? normalized;
}

export function buildSouthAsia(
  rows: readonly Readonly<Record<string, string>>[],
  scope: SouthAsiaScopeContract = SOUTH_ASIA_SCOPE_V1,
) {
  const target = new Set(scope.canonicalCountries.map((country) => normalizeCountry(country, scope)));
  const output = rows.filter((row) =>
    normalizeProductText(row.Geo_Country_Name)
      .split(/[/,;|]/u)
      .some((country) => target.has(normalizeCountry(country, scope))),
  ).map((row) => ({ ...row }));
  return result(output, [], rows.length);
}
