import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const FIXTURE_ROOT = new URL("../tests/fixtures/pipelines/", import.meta.url);
const SOURCE_ORDER = ["JP", "IMB", "AX", "ETNO", "WCD"] as const;

type Severity = "error" | "warning";

type Finding = {
  caseId: string;
  code: string;
  severity: Severity;
  detail: string;
};

type SourceInput = {
  schemaVersion: number;
  expectedFields: string[];
  countryAliases: Record<string, { iso3: string; name: string }>;
  rows: Array<{
    caseId: string;
    source: string;
    datasetRowKey: string | null;
    peopleName: string | null;
    country: string;
    rop1: string;
    rop3: string | null;
    ropPeopleCode?: string;
    population: string;
    frontier: string;
    unexpectedFields?: string[];
  }>;
};

type IdentityInput = {
  schemaVersion: number;
  nextUuid: number;
  ledger: Record<string, string>;
  rows: Array<{
    caseId: string;
    source: string;
    datasetRowKey: string | null;
    rop1: string;
    rop3: string | null;
    iso3: string;
    sourceUuid?: string;
  }>;
};

type MergeInput = {
  schemaVersion: number;
  fallbackOrder: string[];
  fields: string[];
  priorities: Record<string, string[]>;
  rows: Array<Record<string, unknown> & {
    caseId: string;
    pgic: string;
    source: string;
  }>;
};

type AggregateInput = {
  schemaVersion: number;
  specificPeopleGroups: Array<{
    caseId: string;
    rop3: string;
    countryName: string;
    population: number;
    percentChristian: number;
    percentEvangelical: number;
    contributingSources: string[];
  }>;
  classificationCases: Array<{
    caseId: string;
    gsec: number;
    frontier: boolean;
    population: number;
    percentEvangelical: number;
    engagementPhase: number | null;
    axSource: boolean;
    gsecSource: string;
    frontierSource: string;
  }>;
  tier2Rows: Array<{ caseId: string; pgic: string; source: string }>;
};

async function readFixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(name, FIXTURE_ROOT), "utf8")) as T;
}

function compareFindings(left: Finding, right: Finding) {
  return left.caseId.localeCompare(right.caseId) || left.code.localeCompare(right.code);
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
}

function normalizeSourceFixtures(input: SourceInput) {
  const findings: Finding[] = [];
  const rows = input.rows.map((row) => {
    const country = input.countryAliases[row.country] ?? null;
    const population = Number(row.population);
    const normalizedPopulation = Number.isFinite(population) ? population : null;
    const frontier = parseBoolean(row.frontier);
    const rop3 = row.rop3?.trim() || row.ropPeopleCode?.trim() || null;

    if (!row.datasetRowKey) {
      findings.push({
        caseId: row.caseId,
        code: "missing_identifier",
        severity: "error",
        detail: "A stable Dataset_Row_Key is required.",
      });
    }
    if (!country) {
      findings.push({
        caseId: row.caseId,
        code: "unknown_country",
        severity: "warning",
        detail: `No approved country alias matches ${row.country}.`,
      });
    }
    if (!rop3) {
      findings.push({
        caseId: row.caseId,
        code: "missing_rop3",
        severity: "warning",
        detail: "The preserved row requires UUID-backed identity because ROP3 is absent.",
      });
    }
    if (normalizedPopulation === null) {
      findings.push({
        caseId: row.caseId,
        code: "invalid_numeric",
        severity: "error",
        detail: `Population is not numeric: ${row.population}.`,
      });
    }
    if (frontier === null) {
      findings.push({
        caseId: row.caseId,
        code: "invalid_boolean",
        severity: "error",
        detail: `Frontier is not a recognized boolean: ${row.frontier}.`,
      });
    }
    if (!row.peopleName) {
      findings.push({
        caseId: row.caseId,
        code: "missing_required_field",
        severity: "error",
        detail: "peopleName is absent after field mapping.",
      });
    }
    for (const field of row.unexpectedFields ?? []) {
      findings.push({
        caseId: row.caseId,
        code: "unexpected_source_field",
        severity: "warning",
        detail: `Unmapped source field detected: ${field}.`,
      });
    }

    return {
      caseId: row.caseId,
      source: row.source,
      datasetRowKey: row.datasetRowKey,
      peopleName: row.peopleName,
      countryName: country?.name ?? null,
      iso3: country?.iso3 ?? null,
      rop1: row.rop1,
      rop3,
      population: normalizedPopulation,
      frontier,
      domainKey: rop3 && country ? `${row.source}:${rop3}:${country.iso3}` : null,
      publishable: true,
    };
  });

  const casesByDomainKey = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.domainKey) continue;
    const cases = casesByDomainKey.get(row.domainKey) ?? [];
    cases.push(row.caseId);
    casesByDomainKey.set(row.domainKey, cases);
  }
  for (const [domainKey, caseIds] of casesByDomainKey) {
    if (caseIds.length < 2) continue;
    for (const caseId of caseIds) {
      findings.push({
        caseId,
        code: "duplicate_domain_key",
        severity: "error",
        detail: `Duplicate source/ROP3/ISO3 key: ${domainKey}.`,
      });
    }
  }

  const casesWithErrors = new Set(findings.filter((finding) => finding.severity === "error").map((finding) => finding.caseId));
  for (const row of rows) row.publishable = !casesWithErrors.has(row.caseId);

  return {
    columns: [
      "caseId",
      "source",
      "datasetRowKey",
      "peopleName",
      "countryName",
      "iso3",
      "rop1",
      "rop3",
      "population",
      "frontier",
      "domainKey",
      "publishable",
    ],
    rows: rows.sort((left, right) => left.caseId.localeCompare(right.caseId)),
    findings: findings.sort(compareFindings),
  };
}

function lastTwoDigits(value: string) {
  const digits = value.match(/\d+/gu)?.join("") ?? "";
  return digits.slice(-2).padStart(2, "0");
}

function sixDigits(value: string) {
  const digits = value.match(/\d+/gu)?.join("") ?? "";
  return digits.slice(-6).padStart(6, "0");
}

function characterizeIdentity(input: IdentityInput) {
  const findings: Finding[] = [];
  let nextUuid = input.nextUuid;
  const rows = input.rows.map((row) => {
    const rop1 = lastTwoDigits(row.rop1);
    const source = row.source.trim().toUpperCase() || "XX";
    const iso3 = row.iso3.trim().toUpperCase() || "XXX";
    let subject = row.rop3 ? sixDigits(row.rop3) : null;
    let outcome = row.rop3 ? "rop3-derived" : "unassigned";

    if (!row.rop3) {
      if (!row.datasetRowKey) {
        findings.push({
          caseId: row.caseId,
          code: "missing_dataset_row_key",
          severity: "error",
          detail: "A no-ROP3 row cannot reuse or allocate an identity without Dataset_Row_Key.",
        });
      } else {
        const ledgerUuid = input.ledger[row.datasetRowKey] ?? null;
        const sourceUuid = row.sourceUuid ?? null;
        if (sourceUuid && !/^\d{1,6}$/u.test(sourceUuid)) {
          findings.push({
            caseId: row.caseId,
            code: "invalid_source_uuid",
            severity: "error",
            detail: `Source UUID is not one to six digits: ${sourceUuid}.`,
          });
        } else if (sourceUuid && ledgerUuid && sixDigits(sourceUuid) !== sixDigits(ledgerUuid)) {
          findings.push({
            caseId: row.caseId,
            code: "identity_registry_conflict",
            severity: "error",
            detail: `Source UUID ${sixDigits(sourceUuid)} conflicts with registry UUID ${sixDigits(ledgerUuid)}.`,
          });
        } else if (sourceUuid) {
          subject = sixDigits(sourceUuid);
          outcome = "source-retained";
        } else if (ledgerUuid) {
          subject = sixDigits(ledgerUuid);
          outcome = "ledger-reused";
        } else {
          subject = String(nextUuid).padStart(6, "0");
          nextUuid += 1;
          outcome = "uuid-minted";
        }
      }
    }

    const hasError = findings.some((finding) => finding.caseId === row.caseId && finding.severity === "error");
    const pgac = subject && !hasError ? `${rop1}-${source}-${subject}` : null;
    return {
      caseId: row.caseId,
      outcome: hasError ? "blocked" : outcome,
      uuid: row.rop3 || hasError ? null : subject,
      pgac,
      pgic: pgac ? `${pgac}-${iso3}` : null,
    };
  });
  return {
    rows: rows.sort((left, right) => left.caseId.localeCompare(right.caseId)),
    findings: findings.sort(compareFindings),
    nextUuid,
  };
}

function characterizeMerge(input: MergeInput) {
  const findings: Finding[] = [];
  const duplicateKeys = new Set<string>();
  const sourceKeyCounts = new Map<string, number>();
  for (const row of input.rows) {
    const key = `${row.pgic}:${row.source}`;
    const count = (sourceKeyCounts.get(key) ?? 0) + 1;
    sourceKeyCounts.set(key, count);
    if (count > 1) duplicateKeys.add(row.pgic);
  }
  for (const pgic of duplicateKeys) {
    findings.push({
      caseId: pgic,
      code: "duplicate_source_binding",
      severity: "error",
      detail: "One source contributes more than one row for the same canonical PGIC.",
    });
  }

  const rows = [...new Set(input.rows.map((row) => row.pgic))]
    .filter((pgic) => !duplicateKeys.has(pgic))
    .sort()
    .map((pgic) => {
      const candidates = input.rows.filter((row) => row.pgic === pgic);
      const values: Record<string, unknown> = {};
      const provenance: Record<string, string | null> = {};
      for (const field of input.fields) {
        const explicitPriority = input.priorities[field];
        const order = explicitPriority ?? input.fallbackOrder;
        const rank = new Map(order.map((source, index) => [source, index]));
        const winner = candidates
          .filter((row) => row[field] !== null && row[field] !== undefined && row[field] !== "")
          .sort((left, right) => {
            const rankDiff = (rank.get(left.source) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.source) ?? Number.MAX_SAFE_INTEGER);
            return rankDiff || left.caseId.localeCompare(right.caseId);
          })[0];
        values[field] = winner?.[field] ?? null;
        provenance[field] = winner?.source ?? null;
        if (!explicitPriority && winner) {
          findings.push({
            caseId: pgic,
            code: "priority_fallback_used",
            severity: "warning",
            detail: `${field} used fallback ${input.fallbackOrder.join(" > ")}; winner ${winner.source}.`,
          });
        }
      }
      return { pgic, values, provenance };
    });

  return { rows, findings: findings.sort(compareFindings) };
}

function round(value: number) {
  return Number(value.toFixed(6));
}

function characterizeAggregates(input: AggregateInput) {
  const byRop3 = new Map<string, typeof input.specificPeopleGroups>();
  for (const row of input.specificPeopleGroups) {
    const rows = byRop3.get(row.rop3) ?? [];
    rows.push(row);
    byRop3.set(row.rop3, rows);
  }
  const aggregate1 = [...byRop3]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([rop3, rows]) => {
      const totalPopulation = rows.reduce((total, row) => total + row.population, 0);
      const rankedCountries = [...rows].sort((left, right) => right.population - left.population || left.countryName.localeCompare(right.countryName));
      const sources = SOURCE_ORDER.filter((source) => rows.some((row) => row.contributingSources.includes(source)));
      return {
        rop3,
        population: totalPopulation,
        percentChristian: round(rows.reduce((total, row) => total + row.population * row.percentChristian, 0) / totalPopulation),
        percentEvangelical: round(rows.reduce((total, row) => total + row.population * row.percentEvangelical, 0) / totalPopulation),
        primaryCountry: rankedCountries[0]?.countryName ?? null,
        alternateCountries: rankedCountries.slice(1).map((row) => row.countryName),
        contributingSources: sources,
        joint: SOURCE_ORDER.every((source) => sources.includes(source)),
        workersNeeded: Math.ceil(totalPopulation / 50_000),
      };
    });

  const classifications = input.classificationCases
    .map((row) => {
      const evangelicalBelievers = row.population * (row.percentEvangelical / 100);
      const selfEngaged = row.gsec <= 2
        && !row.frontier
        && evangelicalBelievers >= 50
        && (row.percentEvangelical >= 0.05 || evangelicalBelievers >= 500)
        && ((row.axSource && (row.engagementPhase ?? 0) >= 6) || row.percentEvangelical >= 1);
      const watchlist = (row.gsecSource !== "IMB" || row.gsec <= 2)
        && (row.frontierSource !== "JP" || row.frontier)
        && evangelicalBelievers < 50
        && (row.percentEvangelical < 0.05 || evangelicalBelievers < 500)
        && row.percentEvangelical < 1;
      return {
        caseId: row.caseId,
        evangelicalBelievers: round(evangelicalBelievers),
        selfEngaged,
        watchlist,
      };
    })
    .sort((left, right) => left.caseId.localeCompare(right.caseId));

  const tier2Groups = new Map<string, typeof input.tier2Rows>();
  for (const row of input.tier2Rows) {
    const rows = tier2Groups.get(row.pgic) ?? [];
    rows.push(row);
    tier2Groups.set(row.pgic, rows);
  }
  const tier2Conflicts = [...tier2Groups]
    .filter(([, rows]) => rows.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([pgic, rows]) => ({
      pgic,
      severity: "error" as const,
      caseIds: rows.map((row) => row.caseId).sort(),
      sources: rows.map((row) => row.source).sort(),
    }));

  return { aggregate1, classifications, tier2Conflicts };
}

function canonicalJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function computePipelineCharacterization() {
  const [source, identity, merge, aggregate] = await Promise.all([
    readFixture<SourceInput>("source-inputs.json"),
    readFixture<IdentityInput>("identity-inputs.json"),
    readFixture<MergeInput>("merge-inputs.json"),
    readFixture<AggregateInput>("aggregate-inputs.json"),
  ]);
  if (![source.schemaVersion, identity.schemaVersion, merge.schemaVersion, aggregate.schemaVersion].every((version) => version === 1)) {
    throw new Error("Unsupported pipeline characterization fixture schema.");
  }
  const inputChecksum = createHash("sha256")
    .update(canonicalJson({ source, identity, merge, aggregate }))
    .digest("hex");
  const result = {
    schemaVersion: 1,
    inputChecksum,
    source: normalizeSourceFixtures(source),
    identity: characterizeIdentity(identity),
    merge: characterizeMerge(merge),
    aggregate: characterizeAggregates(aggregate),
  };
  return {
    ...result,
    checksum: createHash("sha256").update(canonicalJson(result)).digest("hex"),
  };
}

export async function verifyPipelineCharacterization() {
  const actual = await computePipelineCharacterization();
  const expected = await readFixture<Awaited<ReturnType<typeof computePipelineCharacterization>>>("expected-output.json");
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error("Pipeline characterization differs from tests/fixtures/pipelines/expected-output.json.");
  }
  return actual;
}

async function main() {
  if (process.argv.includes("--print-actual")) {
    console.log(canonicalJson(await computePipelineCharacterization()));
    return;
  }
  const result = await verifyPipelineCharacterization();
  console.log(`Pipeline characterization passed (${result.checksum}).`);
  console.log(`Source cases: ${result.source.rows.length}; findings: ${result.source.findings.length}.`);
  console.log(`Identity cases: ${result.identity.rows.length}; findings: ${result.identity.findings.length}.`);
  console.log(`Merge rows: ${result.merge.rows.length}; findings: ${result.merge.findings.length}.`);
  console.log(`Aggregate 1 rows: ${result.aggregate.aggregate1.length}; Tier 2 conflicts: ${result.aggregate.tier2Conflicts.length}.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
