import { normalizeHeaders } from "@/lib/csv";
import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

import type {
  Aggregate2Candidate,
  Aggregate2InputPublications,
  Tier2OutOfDateState,
  Tier2PartnerPublication,
  Tier2ProductCandidate,
  Tier2ReleaseCandidate,
  Tier2ReleaseDefinition,
  Tier2ReleaseFinding,
} from "./types";

export const TIER2_CANONICAL_PGIC_FIELD =
  "PG_AX_unique_PG_ID_PGIC" as const;

const TIER2_CANONICAL_PGIC_FIELD_ALIASES = [
  TIER2_CANONICAL_PGIC_FIELD,
  "AX_PGIC",
  "PGIC",
] as const;

export const TIER2_UNION_DESCRIPTION =
  "Tier 2 provenance-preserving partner union" as const;
export const AGGREGATE2_UNION_DESCRIPTION =
  "Aggregate 2 Combined Release" as const;

const TIER2_PROVENANCE_FIELDS = [
  "Tier2_Member_Position",
  "Tier2_Profile_Key",
  "Tier2_Partner_Key",
  "Tier2_Publication_ID",
  "Tier2_Source_Row_Index",
] as const;

const AGGREGATE2_PROVENANCE_FIELDS = [
  "Aggregate2_Member_Position",
  "Aggregate2_Member_Kind",
  "Aggregate2_Publication_ID",
  "Aggregate2_Source_Row_Index",
] as const;

function releaseFinding(
  input: Omit<Tier2ReleaseFinding, "details"> & {
    details?: Readonly<Record<string, unknown>>;
  },
): Tier2ReleaseFinding {
  return { ...input, details: input.details ?? {} };
}

function valueByLabel(
  columns: readonly { key: string; label: string }[],
  row: Readonly<Record<string, string>>,
  label: string,
) {
  const key = columns.find((column) => column.label === label)?.key;
  return key ? row[key] ?? "" : "";
}

function unionColumns(
  inputs: readonly { columns: readonly { label: string }[] }[],
  provenance: readonly string[],
) {
  return normalizeHeaders([
    ...new Set([
      ...inputs.flatMap((input) => input.columns.map((column) => column.label)),
      ...provenance,
    ]),
  ]);
}

function remapRow(input: {
  targetColumns: readonly { key: string; label: string }[];
  sourceColumns: readonly { key: string; label: string }[];
  sourceRow: Readonly<Record<string, string>>;
  provenance: Readonly<Record<string, string>>;
}) {
  return Object.fromEntries(
    input.targetColumns.map((column) => [
      column.key,
      input.provenance[column.label] ??
        valueByLabel(input.sourceColumns, input.sourceRow, column.label),
    ]),
  );
}

function duplicateCanonicalIdentityFindings(input: {
  columns: readonly { key: string; label: string }[];
  rows: readonly Readonly<Record<string, string>>[];
  memberPositionField: string;
}) {
  const findings: Tier2ReleaseFinding[] = [];
  const groups = new Map<string, number[]>();
  input.rows.forEach((row, rowIndex) => {
    const canonicalPgic = TIER2_CANONICAL_PGIC_FIELD_ALIASES
      .map((label) => valueByLabel(input.columns, row, label).trim())
      .find(Boolean) ?? "";
    if (!canonicalPgic) {
      findings.push(
        releaseFinding({
          severity: "error",
          ruleCode: "missing-canonical-identity",
          message: "Union row has no canonical PGIC identity.",
          memberPosition: Number(
            valueByLabel(input.columns, row, input.memberPositionField),
          ),
          rowIndex,
          canonicalPgic: null,
        }),
      );
      return;
    }
    groups.set(canonicalPgic, [...(groups.get(canonicalPgic) ?? []), rowIndex]);
  });
  for (const [canonicalPgic, rowIndexes] of groups) {
    if (rowIndexes.length < 2) continue;
    for (const rowIndex of rowIndexes) {
      const row = input.rows[rowIndex]!;
      findings.push(
        releaseFinding({
          severity: "error",
          ruleCode: "duplicate-canonical-identity",
          message: `Canonical PGIC ${canonicalPgic} occurs more than once; all conflicting rows remain inspectable.`,
          memberPosition: Number(
            valueByLabel(input.columns, row, input.memberPositionField),
          ),
          rowIndex,
          canonicalPgic,
          details: { conflictingRowIndexes: rowIndexes },
        }),
      );
    }
  }
  return findings;
}

function validateReleaseDefinition(definition: Tier2ReleaseDefinition) {
  const findings: Tier2ReleaseFinding[] = [];
  if (!definition.key.trim() || !definition.version.trim()) {
    findings.push(
      releaseFinding({
        severity: "error",
        ruleCode: "invalid-release-definition",
        message: "Release definition key and version are required.",
        memberPosition: null,
        rowIndex: null,
        canonicalPgic: null,
      }),
    );
  }
  const duplicateKeys = definition.requiredProfileKeys.filter(
    (key, index, keys) => keys.indexOf(key) !== index,
  );
  for (const profileKey of new Set(duplicateKeys)) {
    findings.push(
      releaseFinding({
        severity: "error",
        ruleCode: "duplicate-required-profile",
        message: `Release definition repeats required profile ${profileKey}.`,
        memberPosition: null,
        rowIndex: null,
        canonicalPgic: null,
      }),
    );
  }
  if (definition.requiredProfileKeys.length === 0) {
    findings.push(
      releaseFinding({
        severity: "error",
        ruleCode: "empty-release-definition",
        message: "Tier 2 requires at least one partner profile.",
        memberPosition: null,
        rowIndex: null,
        canonicalPgic: null,
      }),
    );
  }
  return findings;
}

export function buildTier2ReleaseCandidate(input: {
  definition: Tier2ReleaseDefinition;
  publications: readonly Tier2PartnerPublication[];
}): Tier2ReleaseCandidate {
  const findings = validateReleaseDefinition(input.definition);
  const byProfile = new Map<string, Tier2PartnerPublication[]>();
  for (const publication of input.publications) {
    byProfile.set(publication.profileKey, [
      ...(byProfile.get(publication.profileKey) ?? []),
      publication,
    ]);
  }
  for (const profileKey of input.definition.requiredProfileKeys) {
    const matches = byProfile.get(profileKey) ?? [];
    if (matches.length === 0) {
      findings.push(
        releaseFinding({
          severity: "error",
          ruleCode: "missing-required-partner",
          message: `Required partner profile ${profileKey} is missing.`,
          memberPosition: input.definition.requiredProfileKeys.indexOf(profileKey),
          rowIndex: null,
          canonicalPgic: null,
        }),
      );
    } else if (matches.length > 1) {
      findings.push(
        releaseFinding({
          severity: "error",
          ruleCode: "duplicate-partner-publication",
          message: `Partner profile ${profileKey} has more than one selected publication.`,
          memberPosition: input.definition.requiredProfileKeys.indexOf(profileKey),
          rowIndex: null,
          canonicalPgic: null,
          details: {
            publicationIds: matches.map((publication) => publication.publicationId),
          },
        }),
      );
    }
  }
  for (const profileKey of byProfile.keys()) {
    if (!input.definition.requiredProfileKeys.includes(profileKey)) {
      findings.push(
        releaseFinding({
          severity: "error",
          ruleCode: "unexpected-partner-publication",
          message: `Partner profile ${profileKey} is not in this release definition.`,
          memberPosition: null,
          rowIndex: null,
          canonicalPgic: null,
        }),
      );
    }
  }

  const orderedMembers = input.definition.requiredProfileKeys.flatMap(
    (profileKey) => {
      const matches = byProfile.get(profileKey) ?? [];
      return matches.length === 1 ? matches : [];
    },
  );
  const columns = unionColumns(orderedMembers, TIER2_PROVENANCE_FIELDS);
  const rows = orderedMembers.flatMap((publication, memberPosition) =>
    publication.rows.map((sourceRow, rowIndex) =>
      remapRow({
        targetColumns: columns,
        sourceColumns: publication.columns,
        sourceRow,
        provenance: {
          Tier2_Member_Position: String(memberPosition),
          Tier2_Profile_Key: publication.profileKey,
          Tier2_Partner_Key: publication.partnerKey,
          Tier2_Publication_ID: publication.publicationId,
          Tier2_Source_Row_Index: String(rowIndex),
        },
      }),
    ),
  );
  findings.push(
    ...duplicateCanonicalIdentityFindings({
      columns,
      rows,
      memberPositionField: "Tier2_Member_Position",
    }),
  );

  const inputFingerprint = checksumSourceFormingValue({
    definition: input.definition,
    members: orderedMembers.map((publication) => ({
      profileKey: publication.profileKey,
      publicationId: publication.publicationId,
      registryRevisionId: publication.registryRevisionId,
      outputChecksum: publication.outputChecksum,
    })),
  });
  return {
    kind: "tier2",
    definitionKey: input.definition.key,
    definitionVersion: input.definition.version,
    columns,
    rows,
    memberPublicationIds: orderedMembers.map(
      (publication) => publication.publicationId,
    ),
    registryRevisionIds: [
      ...new Set(
        orderedMembers.map((publication) => publication.registryRevisionId),
      ),
    ],
    findings,
    outputChecksum: checksumSourceFormingValue({ columns, rows }),
    inputFingerprint,
    valid: !findings.some((finding) => finding.severity === "error"),
  };
}

export function buildAggregate2Candidate(
  publications: Aggregate2InputPublications,
): Aggregate2Candidate {
  const ordered = [
    ["tier2", publications.tier2],
    ["imb", publications.imb],
    ["jp", publications.jp],
  ] as const;
  const columns = unionColumns(
    ordered.map(([, publication]) => publication),
    AGGREGATE2_PROVENANCE_FIELDS,
  );
  const rows = ordered.flatMap(([kind, publication], memberPosition) =>
    publication.rows.map((sourceRow, rowIndex) =>
      remapRow({
        targetColumns: columns,
        sourceColumns: publication.columns,
        sourceRow,
        provenance: {
          Aggregate2_Member_Position: String(memberPosition),
          Aggregate2_Member_Kind: kind,
          Aggregate2_Publication_ID: publication.publicationId,
          Aggregate2_Source_Row_Index: String(rowIndex),
        },
      }),
    ),
  );
  const findings = duplicateCanonicalIdentityFindings({
    columns,
    rows,
    memberPositionField: "Aggregate2_Member_Position",
  });
  const exactPublicationIds = {
    tier2: publications.tier2.publicationId,
    imb: publications.imb.publicationId,
    jp: publications.jp.publicationId,
  };
  return {
    kind: "aggregate2",
    columns,
    rows,
    exactPublicationIds,
    findings,
    outputChecksum: checksumSourceFormingValue({ columns, rows }),
    inputFingerprint: checksumSourceFormingValue({
      inputs: ordered.map(([kind, publication]) => ({
        kind,
        publicationId: publication.publicationId,
        outputChecksum: publication.outputChecksum,
      })),
    }),
    valid: !findings.some((finding) => finding.severity === "error"),
  };
}

export function getAggregate2OutOfDateState(input: {
  candidate: Aggregate2Candidate;
  currentPublicationIds: Readonly<{
    tier2: string;
    imb: string;
    jp: string;
  }>;
}): Tier2OutOfDateState {
  const changedInputs = (["tier2", "imb", "jp"] as const).filter(
    (kind) =>
      input.candidate.exactPublicationIds[kind] !==
      input.currentPublicationIds[kind],
  );
  return { outOfDate: changedInputs.length > 0, changedInputs };
}

export function assertPublishableTier2ProductCandidate(input: {
  candidate: Tier2ProductCandidate;
  status: string;
  outOfDate?: Tier2OutOfDateState;
  reason: string;
}) {
  if (input.status !== "valid" || !input.candidate.valid) {
    throw new Error("Only a valid Tier 2 product candidate can publish.");
  }
  if (!input.reason.trim()) {
    throw new Error("A publication reason is required.");
  }
  if (input.outOfDate?.outOfDate) {
    throw new Error(
      `Candidate is out of date because ${input.outOfDate.changedInputs.join(", ")} advanced.`,
    );
  }
}
