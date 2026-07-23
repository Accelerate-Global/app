import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

import { TIER2_CANONICAL_PGIC_FIELD } from "./releases";

export type Tier2ComparisonDifference = Readonly<{
  canonicalPgic: string;
  legacyCount: number;
  candidateCount: number;
  legacyChecksum: string;
  candidateChecksum: string;
  legacyRows: readonly Readonly<Record<string, string>>[];
  candidateRows: readonly Readonly<Record<string, string>>[];
  outcome: "retained" | "dropped" | "added" | "conflicting";
  explanation: string;
}>;

function valueByLabel(
  columns: readonly { key: string; label: string }[],
  row: Readonly<Record<string, string>>,
  label: string,
) {
  const key = columns.find((column) => column.label === label)?.key;
  return key ? row[key] ?? "" : "";
}

function groupByIdentity(input: {
  columns: readonly { key: string; label: string }[];
  rows: readonly Readonly<Record<string, string>>[];
}) {
  const groups = new Map<string, Readonly<Record<string, string>>[]>();
  for (const row of input.rows) {
    const key = valueByLabel(input.columns, row, TIER2_CANONICAL_PGIC_FIELD) ||
      "(missing canonical identity)";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

export function compareTier2CandidateWithLegacy(input: {
  legacy: {
    columns: readonly { key: string; label: string }[];
    rows: readonly Readonly<Record<string, string>>[];
  };
  candidate: {
    columns: readonly { key: string; label: string }[];
    rows: readonly Readonly<Record<string, string>>[];
  };
}) {
  const legacy = groupByIdentity(input.legacy);
  const candidate = groupByIdentity(input.candidate);
  const identities = [...new Set([...legacy.keys(), ...candidate.keys()])].sort();
  const differences: Tier2ComparisonDifference[] = identities.map(
    (canonicalPgic) => {
      const legacyRows = legacy.get(canonicalPgic) ?? [];
      const candidateRows = candidate.get(canonicalPgic) ?? [];
      const legacyChecksum = checksumSourceFormingValue(legacyRows);
      const candidateChecksum = checksumSourceFormingValue(candidateRows);
      if (legacyRows.length === 0) {
        return {
          canonicalPgic,
          legacyCount: 0,
          candidateCount: candidateRows.length,
          legacyChecksum,
          candidateChecksum,
          legacyRows,
          candidateRows,
          outcome: "added" as const,
          explanation: "Present only in the exact online release inputs.",
        };
      }
      if (candidateRows.length === 0) {
        return {
          canonicalPgic,
          legacyCount: legacyRows.length,
          candidateCount: 0,
          legacyChecksum,
          candidateChecksum,
          legacyRows,
          candidateRows,
          outcome: "dropped" as const,
          explanation:
            "Legacy-only row; inspect the profile, crosswalk, or release completeness findings before cutover.",
        };
      }
      if (
        legacyRows.length === candidateRows.length &&
        legacyChecksum === candidateChecksum
      ) {
        return {
          canonicalPgic,
          legacyCount: legacyRows.length,
          candidateCount: candidateRows.length,
          legacyChecksum,
          candidateChecksum,
          legacyRows,
          candidateRows,
          outcome: "retained" as const,
          explanation: "Row count and canonical payload match exactly.",
        };
      }
      return {
        canonicalPgic,
        legacyCount: legacyRows.length,
        candidateCount: candidateRows.length,
        legacyChecksum,
        candidateChecksum,
        legacyRows,
        candidateRows,
        outcome: "conflicting" as const,
        explanation:
          "The canonical identity is present on both sides but payload or multiplicity differs; no row was silently consolidated.",
      };
    },
  );
  return {
    schemaVersion: 1 as const,
    legacyChecksum: checksumSourceFormingValue(input.legacy),
    candidateChecksum: checksumSourceFormingValue(input.candidate),
    legacyRowCount: input.legacy.rows.length,
    candidateRowCount: input.candidate.rows.length,
    differences,
    counts: {
      retained: differences.filter((entry) => entry.outcome === "retained").length,
      dropped: differences.filter((entry) => entry.outcome === "dropped").length,
      added: differences.filter((entry) => entry.outcome === "added").length,
      conflicting: differences.filter((entry) => entry.outcome === "conflicting")
        .length,
    },
  };
}
