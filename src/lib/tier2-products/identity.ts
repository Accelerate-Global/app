import { normalizeHeaders } from "@/lib/csv";
import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

import { extractTier2IdentityEvidence } from "./forming";
import type {
  Tier2FormingInput,
  Tier2FormingResult,
  Tier2IdentityCandidateResult,
  Tier2IdentityRegistryPort,
  Tier2IdentityResolution,
} from "./types";

const IDENTITY_FIELDS = [
  "PG_AX_unique_PG_ID_PGIC",
  "AX_Identity_ID",
  "AX_Registry_Revision_ID",
] as const;

function valueByLabel(
  columns: readonly { key: string; label: string }[],
  row: Readonly<Record<string, string>>,
  label: string,
) {
  const key = columns.find((column) => column.label === label)?.key;
  return key ? row[key] ?? "" : "";
}

export async function buildTier2IdentityCandidate(input: {
  formingInput: Tier2FormingInput;
  formingResult: Tier2FormingResult;
  registry: Tier2IdentityRegistryPort;
}): Promise<Tier2IdentityCandidateResult> {
  if (!input.formingResult.valid) {
    throw new Error(
      "Tier 2 identity cannot run until all blocking forming findings are corrected.",
    );
  }

  const columns = normalizeHeaders([
    ...input.formingResult.columns.map((column) => column.label),
    ...IDENTITY_FIELDS,
  ]);
  const byLabel = new Map(columns.map((column) => [column.label, column.key]));
  const evidence = extractTier2IdentityEvidence(
    input.formingInput,
    input.formingResult,
  );
  const resolutions: Tier2IdentityResolution[] = [];

  try {
    for (const item of evidence) {
      if (!item.stableRowKey) {
        throw new Error("Tier 2 identity evidence has no stable row key.");
      }
      resolutions.push(await input.registry.resolveOrReserve(item));
    }
  } catch (error) {
    await input.registry.cancelReservations(
      error instanceof Error ? error.message : "Tier 2 identity build failed.",
    );
    throw error;
  }

  const rows = input.formingResult.rows.map((sourceRow, rowIndex) => {
    const resolution = resolutions[rowIndex]!;
    const row = Object.fromEntries(
      columns.map((column) => [
        column.key,
        valueByLabel(input.formingResult.columns, sourceRow, column.label),
      ]),
    );
    row[byLabel.get("PG_AX_unique_PG_ID_PGIC")!] = resolution.canonicalPgic;
    row[byLabel.get("AX_Identity_ID")!] = resolution.identityId;
    row[byLabel.get("AX_Registry_Revision_ID")!] =
      resolution.registryRevisionId;
    return row;
  });

  return {
    columns,
    rows,
    resolutions,
    outputChecksum: checksumSourceFormingValue({ columns, rows }),
    registryRevisionIds: [
      ...new Set(resolutions.map((resolution) => resolution.registryRevisionId)),
    ],
  };
}
