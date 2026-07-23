import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { parse } from "papaparse";

import { isStructurallyValidAxCode } from "./rules";
import type {
  AxIdentityFinding,
  LegacyIdentityImportResult,
  LegacyIdentityRow,
  LegacyIdentitySnapshot,
} from "./types";

function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function compareUtf8(left: string, right: string) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function compareUtf8Tuple(left: readonly string[], right: readonly string[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const comparison = compareUtf8(left[index] ?? "", right[index] ?? "");
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function finding(
  ruleCode: string,
  message: string,
  details: Record<string, unknown>,
): AxIdentityFinding {
  return {
    severity: "error",
    ruleCode,
    sourceRowIndex: null,
    stableRowKey: null,
    message,
    details,
  };
}

function parseAliases(value: unknown) {
  return typeof value === "string"
    ? value
        .split(/[|;]/u)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function parseSnapshot(snapshot: LegacyIdentitySnapshot) {
  const parsed = parse<Record<string, string>>(snapshot.body, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length > 0) {
    throw new Error(`Legacy identity snapshot ${snapshot.path} is not valid CSV.`);
  }
  return parsed.data;
}

export function inspectLegacyIdentitySnapshots(input: {
  snapshots: readonly LegacyIdentitySnapshot[];
  existingCodes?: ReadonlyMap<string, string>;
}): LegacyIdentityImportResult {
  if (input.snapshots.length === 0) {
    throw new Error("At least one explicit legacy identity snapshot is required.");
  }

  const findings: AxIdentityFinding[] = [];
  const rows: LegacyIdentityRow[] = [];

  for (const snapshot of [...input.snapshots].sort((a, b) => compareUtf8(a.path, b.path))) {
    if (!snapshot.path.trim()) throw new Error("Every legacy snapshot requires an explicit path.");
    const actualChecksum = checksum(snapshot.body);
    if (actualChecksum !== snapshot.expectedChecksum.toLowerCase()) {
      findings.push(
        finding("snapshot-checksum-mismatch", "The explicit snapshot checksum does not match.", {
          path: snapshot.path,
          expected: snapshot.expectedChecksum,
          actual: actualChecksum,
        }),
      );
      continue;
    }

    for (const raw of parseSnapshot(snapshot)) {
      rows.push({
        sourceProfileKey: raw.source_profile_key?.trim() ?? "",
        stableRowKey: raw.stable_row_key?.trim() ?? "",
        pgacCode: raw.pgac_code?.trim() ?? "",
        pgicCode: raw.pgic_code?.trim() ?? "",
        uuid: raw.uuid?.trim() || null,
        aliases: parseAliases(raw.aliases),
      });
    }
  }

  const seenKeys = new Map<string, number>();
  const seenCodes = new Map<string, string>();
  const seenUuids = new Map<string, string>();
  rows.forEach((row, index) => {
    const key = `${row.sourceProfileKey}:${row.stableRowKey}`;
    if (!row.sourceProfileKey || !row.stableRowKey) {
      findings.push(finding("orphan-binding", "A legacy binding has no stable source identity.", { index }));
    } else if (seenKeys.has(key)) {
      findings.push(finding("duplicate-source-key", "A stable source key appears more than once.", { key }));
    } else {
      seenKeys.set(key, index);
    }

    if (!isStructurallyValidAxCode(row.pgacCode, "pgac") || !isStructurallyValidAxCode(row.pgicCode, "pgic")) {
      findings.push(finding("malformed-code", "A legacy canonical AX code is malformed.", { key }));
    }

    for (const code of [row.pgacCode, row.pgicCode, ...row.aliases]) {
      if (!isStructurallyValidAxCode(code)) {
        findings.push(finding("malformed-alias", "A legacy AX alias is malformed.", { key, code }));
        continue;
      }
      const existingOwner = seenCodes.get(code) ?? input.existingCodes?.get(code);
      if (existingOwner) {
        findings.push(finding("code-collision", "A canonical or alias code identifies multiple rows.", { code, key, existingOwner }));
      } else {
        seenCodes.set(code, key);
      }
    }

    if (row.uuid) {
      if (!/^\d{6}$/u.test(row.uuid)) {
        findings.push(finding("malformed-uuid", "A legacy UUID value is not six digits.", { key, uuid: row.uuid }));
      } else if (seenUuids.has(row.uuid)) {
        findings.push(finding("duplicate-uuid", "A legacy UUID value identifies multiple rows.", { uuid: row.uuid, key }));
      } else {
        seenUuids.set(row.uuid, key);
      }
      if (row.pgacCode.split("-").at(-1) !== row.uuid) {
        findings.push(
          finding("uuid-code-mismatch", "A legacy UUID value does not match its PGAC suffix.", {
            key,
            uuid: row.uuid,
            pgacCode: row.pgacCode,
          }),
        );
      }
    }

    const parentKey = row.pgicCode.split("-").slice(0, -1).join("-");
    if (row.pgacCode && parentKey && parentKey !== row.pgacCode) {
      findings.push(finding("orphan-pgic", "A PGIC code does not point to its row's PGAC code.", { key }));
    }
  });

  const canonicalSnapshots = [...input.snapshots]
    .sort((a, b) => compareUtf8(a.path, b.path))
    .map((snapshot) => ({ path: snapshot.path, checksum: snapshot.expectedChecksum.toLowerCase() }));
  const inputFingerprint = checksum(JSON.stringify(canonicalSnapshots));

  return {
    inputFingerprint,
    rows,
    findings,
    blocking: findings.some((entry) => entry.severity === "error"),
    committedImportId: null,
  };
}

export function assertLegacyImportCommitAllowed(result: LegacyIdentityImportResult) {
  if (result.blocking) {
    throw new Error("Legacy identity snapshots contain blocking findings and cannot be committed.");
  }
}

export const LEGACY_AX_GRAPH_FILE_KEYS = [
  "sharedUuidLedger",
  "tier1UuidLedger",
  "tier2UuidLedger",
  "sharedRop3Ledger",
  "tier2Rop3Ledger",
] as const;

export type LegacyAxGraphFileKey = (typeof LEGACY_AX_GRAPH_FILE_KEYS)[number];

export type LegacyAxGraphFileManifest = Readonly<{
  relativePath: string;
  sha256: string;
  rowCount: number;
}>;

export type LegacyAxTier2ComponentMapping = Readonly<{
  expectedRowCount: number;
  profileKey: string | null;
}>;

export type LegacyAxBindingTranslationManifest = Readonly<{
  status: "blocked-pending-pinned-source-crosswalk";
  algorithmVersion: "source-forming-runtime-stable-row-key-v1";
  relativePath: null;
  sha256: null;
  rawBindingCount: number;
  selectedActiveBindingCount: 0;
}>;

export type LegacyAxIdentityGraphManifest = Readonly<{
  schemaVersion: 1;
  namespace: "people-groups";
  files: Readonly<Record<LegacyAxGraphFileKey, LegacyAxGraphFileManifest>>;
  tier1SourceProfiles: Readonly<Record<string, string>>;
  tier2Components: Readonly<Record<string, LegacyAxTier2ComponentMapping>>;
  bindingTranslation: LegacyAxBindingTranslationManifest;
  expected: Readonly<{
    tier2Rop3UnionAddedRowCount: number;
    bindingCount: number;
    pgacCount: number;
    pgicCount: number;
    identityCount: number;
    rawUnionPgacCount: number;
    rawUnionPgicCount: number;
    rawUnionIdentityCount: number;
    supersededCanonicalCodeCount: number;
    shortPrimaryNormalizationCount: number;
    crossLedgerMismatchCount: number;
    quarantinedAliasConflictCount: number;
    allocationCounterFloor: number;
  }>;
}>;

export type LegacyAxGraphParent = Readonly<{
  canonicalCode: string;
  allocatedValue: number | null;
  rop3Component: string | null;
}>;

export type LegacyAxGraphChild = Readonly<{
  canonicalCode: string;
  parentCanonicalCode: string;
  normalizedIso3: string;
}>;

export type LegacyAxGraphAlias = Readonly<{
  code: string;
  identityCanonicalCode: string;
  identityKind: "pgac" | "pgic";
}>;

export type LegacyAxGraphBinding = Readonly<{
  sourceProfileKey: string | null;
  stableRowKey: string;
  identityCanonicalCode: string;
  sourcePgacCode: string;
  sourcePgicCode: string;
  tier2Component: string | null;
}>;

export type LegacyAxGraphAudit = Readonly<{
  auditKind:
    | "short-primary-normalized"
    | "cross-ledger-mismatch"
    | "alias-conflict-quarantined";
  sourceFileKey: LegacyAxGraphFileKey;
  stableRowKeyHash: string;
  details: Readonly<Record<string, string>>;
}>;

export type LegacyAxIdentityGraphReport = Readonly<{
  schemaVersion: 1;
  inputFingerprint: string;
  graphChecksum: string;
  blocking: boolean;
  blockingReasons: readonly string[];
  files: Readonly<
    Record<
      LegacyAxGraphFileKey,
      Readonly<{ relativePath: string; sha256: string; rowCount: number }>
    >
  >;
  graph: Readonly<{
    bindings: number;
    pgacIdentities: number;
    pgicIdentities: number;
    identities: number;
    aliases: number;
    allocationCounterFloor: number;
  }>;
  reconciliation: Readonly<{
    shortPrimaryNormalizations: number;
    crossLedgerMismatches: number;
    quarantinedAliasConflicts: number;
    tier2Rop3UnionAddedRows: number;
    rawUnionIdentities: number;
    supersededCanonicalCodes: number;
  }>;
  audit: Readonly<{
    records: number;
    checksum: string;
    artifactChecksum: string;
    decisions: readonly LegacyAxGraphAudit[];
  }>;
  bindingTranslation: Readonly<{
    algorithmVersion: "source-forming-runtime-stable-row-key-v1";
    status: "blocked-pending-pinned-source-crosswalk";
    present: boolean;
    rawBindingCount: number;
    selectedActiveBindingCount: number;
    historicalUnboundCount: number;
    sha256: string | null;
  }>;
  tier2Components: readonly Readonly<{
    component: string;
    observedRowCount: number;
    expectedRowCount: number | null;
    profileKey: string | null;
    mapped: boolean;
  }>[];
}>;

export type LegacyAxIdentityGraphPlan = Readonly<{
  inputFingerprint: string;
  graphChecksum: string;
  reportChecksum: string;
  blocking: boolean;
  parents: readonly LegacyAxGraphParent[];
  children: readonly LegacyAxGraphChild[];
  aliases: readonly LegacyAxGraphAlias[];
  historicalBindings: readonly LegacyAxGraphBinding[];
  bindings: readonly LegacyAxGraphBinding[];
  audits: readonly LegacyAxGraphAudit[];
  report: LegacyAxIdentityGraphReport;
}>;

type LegacyAxRow = Record<string, string>;

type NormalizedOccurrence = Readonly<{
  sourceFileKey: LegacyAxGraphFileKey;
  ledgerKind: "uuid" | "rop3";
  stableRowKey: string;
  canonicalPgac: string;
  canonicalPgic: string;
  normalizedIso3: string;
  allocatedValue: number | null;
  aliases: readonly string[];
  sourceProfileKey: string | null;
  tier2Component: string | null;
  rawPrimaryCode: string;
}>;

const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/u;
const PROFILE_KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const SHORT_PGIC_PATTERN = /^\d{2}-[a-z0-9]{1,8}-\d{1,5}-[A-Z]{3}$/u;
const TIER2_DATASET_PATTERN = /^(?:ax_final_|ff_|ftt_|nema_|tti_)/u;
const UUID_HEADERS = [
  "AX Code",
  "Dataset_Row_Key",
  "ROP1",
  "Data Source",
  "AX UUID",
  "ISO3",
  ...Array.from({ length: 20 }, (_, index) => `Alias ${index + 1}`),
] as const;
const ROP3_HEADERS = [
  "Dataset_Row_Key",
  "AX Code",
  "PGAC",
  "PGIC",
  "ROP1",
  "ROP3",
  "Data Source",
  "ISO3",
  "Dataset",
  "Prefix",
  ...Array.from({ length: 20 }, (_, index) => `Alias ${index + 1}`),
  "AX UUID",
] as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareUtf8(left, right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function checksumValue(value: unknown) {
  return checksum(canonicalJson(value));
}

function requireRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requirePositiveInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

export function parseLegacyAxIdentityGraphManifest(
  value: unknown,
): LegacyAxIdentityGraphManifest {
  const manifest = requireRecord(value, "Legacy AX graph manifest");
  if (manifest.schemaVersion !== 1 || manifest.namespace !== "people-groups") {
    throw new Error("The legacy AX graph manifest schema or namespace is invalid.");
  }

  const rawFiles = requireRecord(manifest.files, "Legacy AX graph manifest files");
  const files = {} as Record<LegacyAxGraphFileKey, LegacyAxGraphFileManifest>;
  for (const key of LEGACY_AX_GRAPH_FILE_KEYS) {
    const rawFile = requireRecord(rawFiles[key], `Legacy AX graph file ${key}`);
    if (
      typeof rawFile.relativePath !== "string" ||
      !rawFile.relativePath.trim() ||
      rawFile.relativePath.startsWith("/") ||
      rawFile.relativePath.split(/[\\/]/u).includes("..") ||
      typeof rawFile.sha256 !== "string" ||
      !CHECKSUM_PATTERN.test(rawFile.sha256)
    ) {
      throw new Error(`Legacy AX graph file ${key} is not pinned to a safe path and checksum.`);
    }
    files[key] = {
      relativePath: rawFile.relativePath,
      sha256: rawFile.sha256,
      rowCount: requirePositiveInteger(rawFile.rowCount, `${key}.rowCount`),
    };
  }
  const unexpectedFiles = Object.keys(rawFiles).filter(
    (key) => !(LEGACY_AX_GRAPH_FILE_KEYS as readonly string[]).includes(key),
  );
  if (unexpectedFiles.length > 0) {
    throw new Error("The legacy AX graph manifest contains unsupported snapshot keys.");
  }

  const rawTier1 = requireRecord(
    manifest.tier1SourceProfiles,
    "Legacy AX Tier 1 source map",
  );
  const tier1SourceProfiles: Record<string, string> = {};
  for (const [source, profile] of Object.entries(rawTier1)) {
    if (
      !/^[a-z][a-z0-9]*$/u.test(source) ||
      typeof profile !== "string" ||
      !PROFILE_KEY_PATTERN.test(profile)
    ) {
      throw new Error("The legacy AX Tier 1 source map contains an invalid exact mapping.");
    }
    tier1SourceProfiles[source] = profile;
  }

  const rawTier2 = requireRecord(manifest.tier2Components, "Legacy AX Tier 2 source map");
  const tier2Components: Record<string, LegacyAxTier2ComponentMapping> = {};
  for (const [component, rawMapping] of Object.entries(rawTier2)) {
    const mapping = requireRecord(rawMapping, `Legacy AX Tier 2 component ${component}`);
    if (!/^(?:dataset|spreadsheet):\S+$/u.test(component)) {
      throw new Error("The legacy AX Tier 2 source map contains an invalid component ID.");
    }
    if (
      mapping.profileKey !== null &&
      (typeof mapping.profileKey !== "string" || !PROFILE_KEY_PATTERN.test(mapping.profileKey))
    ) {
      throw new Error("The legacy AX Tier 2 source map contains an invalid profile key.");
    }
    tier2Components[component] = {
      expectedRowCount: requirePositiveInteger(
        mapping.expectedRowCount,
        `${component}.expectedRowCount`,
      ),
      profileKey: mapping.profileKey as string | null,
    };
  }

  const rawExpected = requireRecord(manifest.expected, "Legacy AX graph expected counts");
  const expected = {
    tier2Rop3UnionAddedRowCount: requirePositiveInteger(
      rawExpected.tier2Rop3UnionAddedRowCount,
      "expected.tier2Rop3UnionAddedRowCount",
    ),
    bindingCount: requirePositiveInteger(rawExpected.bindingCount, "expected.bindingCount"),
    pgacCount: requirePositiveInteger(rawExpected.pgacCount, "expected.pgacCount"),
    pgicCount: requirePositiveInteger(rawExpected.pgicCount, "expected.pgicCount"),
    identityCount: requirePositiveInteger(rawExpected.identityCount, "expected.identityCount"),
    rawUnionPgacCount: requirePositiveInteger(
      rawExpected.rawUnionPgacCount,
      "expected.rawUnionPgacCount",
    ),
    rawUnionPgicCount: requirePositiveInteger(
      rawExpected.rawUnionPgicCount,
      "expected.rawUnionPgicCount",
    ),
    rawUnionIdentityCount: requirePositiveInteger(
      rawExpected.rawUnionIdentityCount,
      "expected.rawUnionIdentityCount",
    ),
    supersededCanonicalCodeCount: requirePositiveInteger(
      rawExpected.supersededCanonicalCodeCount,
      "expected.supersededCanonicalCodeCount",
    ),
    shortPrimaryNormalizationCount: requirePositiveInteger(
      rawExpected.shortPrimaryNormalizationCount,
      "expected.shortPrimaryNormalizationCount",
    ),
    crossLedgerMismatchCount: requirePositiveInteger(
      rawExpected.crossLedgerMismatchCount,
      "expected.crossLedgerMismatchCount",
    ),
    quarantinedAliasConflictCount: requirePositiveInteger(
      rawExpected.quarantinedAliasConflictCount,
      "expected.quarantinedAliasConflictCount",
    ),
    allocationCounterFloor: requirePositiveInteger(
      rawExpected.allocationCounterFloor,
      "expected.allocationCounterFloor",
    ),
  };

  const rawBindingTranslation = requireRecord(
    manifest.bindingTranslation,
    "Legacy AX binding translation",
  );
  if (
    rawBindingTranslation.status !== "blocked-pending-pinned-source-crosswalk" ||
    rawBindingTranslation.algorithmVersion !==
      "source-forming-runtime-stable-row-key-v1" ||
    rawBindingTranslation.relativePath !== null ||
    rawBindingTranslation.sha256 !== null ||
    rawBindingTranslation.selectedActiveBindingCount !== 0
  ) {
    throw new Error(
      "Legacy AX cutover must remain blocked until exact source snapshots and a reviewed runtime crosswalk are implemented and pinned in the repository.",
    );
  }
  const bindingTranslation: LegacyAxBindingTranslationManifest = {
    status: "blocked-pending-pinned-source-crosswalk",
    algorithmVersion: "source-forming-runtime-stable-row-key-v1",
    relativePath: null,
    sha256: null,
    rawBindingCount: requirePositiveInteger(
      rawBindingTranslation.rawBindingCount,
      "bindingTranslation.rawBindingCount",
    ),
    selectedActiveBindingCount: 0,
  };
  if (bindingTranslation.rawBindingCount !== expected.bindingCount) {
    throw new Error("The pending runtime crosswalk must account for every historical binding.");
  }

  return {
    schemaVersion: 1,
    namespace: "people-groups",
    files,
    tier1SourceProfiles,
    tier2Components,
    bindingTranslation,
    expected,
  };
}

function immutableManifestShape(manifest: LegacyAxIdentityGraphManifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    namespace: manifest.namespace,
    files: manifest.files,
    tier1SourceProfiles: manifest.tier1SourceProfiles,
    tier2Components: Object.fromEntries(
      Object.entries(manifest.tier2Components).map(([component, mapping]) => [
        component,
        { expectedRowCount: mapping.expectedRowCount },
      ]),
    ),
    bindingTranslation: manifest.bindingTranslation,
    expected: manifest.expected,
  };
}

export function assertLegacyAxIdentityGraphManifestOverlay(input: {
  canonical: LegacyAxIdentityGraphManifest;
  overlay: LegacyAxIdentityGraphManifest;
}) {
  if (
    canonicalJson(immutableManifestShape(input.canonical)) !==
    canonicalJson(immutableManifestShape(input.overlay))
  ) {
    throw new Error(
      "The reviewed legacy AX manifest may change only Tier 2 profileKey values.",
    );
  }
}

function parsePinnedRows(
  fileKey: LegacyAxGraphFileKey,
  body: Buffer,
  headers: readonly string[],
) {
  const parsed = parse<LegacyAxRow>(body.toString("utf8"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\ufeff/u, "").trim(),
  });
  const fatalErrors = parsed.errors.filter((error) => error.code !== "TooFewFields");
  if (fatalErrors.length > 0) {
    throw new Error(`Pinned legacy AX snapshot ${fileKey} is not valid CSV.`);
  }
  if (canonicalJson(parsed.meta.fields ?? []) !== canonicalJson(headers)) {
    throw new Error(`Pinned legacy AX snapshot ${fileKey} has an unexpected header contract.`);
  }
  return parsed.data.map((row) =>
    Object.fromEntries(headers.map((header) => [header, row[header]?.trim() ?? ""])),
  );
}

function rowSignature(row: LegacyAxRow, headers: readonly string[]) {
  return canonicalJson(headers.map((header) => row[header] ?? ""));
}

function aliasesFor(row: LegacyAxRow) {
  return Array.from({ length: 20 }, (_, index) => row[`Alias ${index + 1}`] ?? "").filter(
    Boolean,
  );
}

function pgacForPgic(pgic: string) {
  return pgic.split("-").slice(0, -1).join("-");
}

function sixDigitForPgac(pgac: string) {
  return pgac.split("-").at(-1) ?? "";
}

function iso3ForPgic(pgic: string) {
  return pgic.split("-").at(-1) ?? "";
}

function stableRowKeyHash(stableRowKey: string) {
  return checksum(stableRowKey);
}

function tier2ComponentFor(row: LegacyAxRow) {
  const dataset = row.Dataset?.trim();
  if (dataset) return `dataset:${dataset}`;
  const parts = row.Dataset_Row_Key.split(":");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("A Tier 2 legacy row does not contain one explicit component ID.");
  }
  return `spreadsheet:${parts[1]}`;
}

function sourceAssignment(input: {
  row: LegacyAxRow;
  ledgerKind: "uuid" | "rop3";
  sourceFileKey: LegacyAxGraphFileKey;
  tier2UuidSignatures: ReadonlySet<string>;
  uuidHeaders: readonly string[];
  manifest: LegacyAxIdentityGraphManifest;
}) {
  const source = input.row["Data Source"].toLowerCase();
  const tier1Profile = input.manifest.tier1SourceProfiles[source] ?? null;
  const isTier2 =
    (input.ledgerKind === "uuid" &&
      input.tier2UuidSignatures.has(rowSignature(input.row, input.uuidHeaders))) ||
    (input.ledgerKind === "rop3" &&
      (input.sourceFileKey === "tier2Rop3Ledger" ||
        !tier1Profile ||
        TIER2_DATASET_PATTERN.test(input.row.Dataset)));

  if (!isTier2) {
    if (!tier1Profile) {
      throw new Error("A Tier 1 legacy source is not present in the exact source map.");
    }
    return { sourceProfileKey: tier1Profile, tier2Component: null } as const;
  }

  const component = tier2ComponentFor(input.row);
  return {
    sourceProfileKey: input.manifest.tier2Components[component]?.profileKey ?? null,
    tier2Component: component,
  } as const;
}

function normalizeUuidOccurrence(input: {
  row: LegacyAxRow;
  source: ReturnType<typeof sourceAssignment>;
}): { occurrence: NormalizedOccurrence; shortPrimaryAudit: LegacyAxGraphAudit | null } {
  const uuid = input.row["AX UUID"];
  if (!/^\d{1,6}$/u.test(uuid)) {
    throw new Error("The shared UUID ledger contains an invalid historical allocation value.");
  }
  const allocatedValue = Number(uuid);
  if (allocatedValue < 1 || allocatedValue > 999999) {
    throw new Error("The shared UUID ledger contains an out-of-range allocation value.");
  }
  const rawPrimaryCode = input.row["AX Code"];
  let canonicalPgic = rawPrimaryCode;
  let shortPrimaryAudit: LegacyAxGraphAudit | null = null;
  if (SHORT_PGIC_PATTERN.test(rawPrimaryCode)) {
    const expected = `${rawPrimaryCode.split("-").slice(0, -2).join("-")}-${uuid.padStart(6, "0")}-${iso3ForPgic(rawPrimaryCode)}`;
    const validAliases = aliasesFor(input.row).filter((alias) =>
      isStructurallyValidAxCode(alias, "pgic"),
    );
    if (validAliases.length !== 1 || validAliases[0] !== expected) {
      throw new Error(
        "A malformed UUID primary does not have one exact zero-padded canonical alias.",
      );
    }
    canonicalPgic = expected;
    shortPrimaryAudit = {
      auditKind: "short-primary-normalized",
      sourceFileKey: "sharedUuidLedger",
      stableRowKeyHash: stableRowKeyHash(input.row.Dataset_Row_Key),
      details: {
        historicalPrimaryCode: rawPrimaryCode,
        canonicalCode: canonicalPgic,
        historicalUuid: uuid,
      },
    };
  }
  if (!isStructurallyValidAxCode(canonicalPgic, "pgic")) {
    throw new Error("The shared UUID ledger contains a malformed canonical PGIC.");
  }
  const canonicalPgac = pgacForPgic(canonicalPgic);
  return {
    occurrence: {
      sourceFileKey: "sharedUuidLedger",
      ledgerKind: "uuid",
      stableRowKey: input.row.Dataset_Row_Key,
      canonicalPgac,
      canonicalPgic,
      normalizedIso3: iso3ForPgic(canonicalPgic),
      allocatedValue,
      aliases: aliasesFor(input.row),
      sourceProfileKey: input.source.sourceProfileKey,
      tier2Component: input.source.tier2Component,
      rawPrimaryCode,
    },
    shortPrimaryAudit,
  };
}

function normalizeRop3Occurrence(input: {
  row: LegacyAxRow;
  sourceFileKey: "sharedRop3Ledger" | "tier2Rop3Ledger";
  source: ReturnType<typeof sourceAssignment>;
}) {
  const canonicalPgic = input.row.PGIC || input.row["AX Code"];
  const canonicalPgac = input.row.PGAC || pgacForPgic(canonicalPgic);
  if (
    !isStructurallyValidAxCode(canonicalPgac, "pgac") ||
    !isStructurallyValidAxCode(canonicalPgic, "pgic") ||
    pgacForPgic(canonicalPgic) !== canonicalPgac
  ) {
    throw new Error("The ROP3 ledger contains an invalid canonical PGAC/PGIC relationship.");
  }
  if (input.row.ROP3 && input.row.ROP3 !== sixDigitForPgac(canonicalPgac)) {
    throw new Error("The ROP3 ledger canonical code does not match its ROP3 component.");
  }
  return {
    sourceFileKey: input.sourceFileKey,
    ledgerKind: "rop3",
    stableRowKey: input.row.Dataset_Row_Key,
    canonicalPgac,
    canonicalPgic,
    normalizedIso3: iso3ForPgic(canonicalPgic),
    allocatedValue: null,
    aliases: aliasesFor(input.row),
    sourceProfileKey: input.source.sourceProfileKey,
    tier2Component: input.source.tier2Component,
    rawPrimaryCode: input.row["AX Code"],
  } satisfies NormalizedOccurrence;
}

function assertExpectedCount(actual: number, expected: number, label: string) {
  if (actual !== expected) {
    throw new Error(`Pinned legacy AX ${label} changed: expected ${expected}, received ${actual}.`);
  }
}

export function computeLegacyAxIdentityGraphChecksum(input: {
  parents: readonly LegacyAxGraphParent[];
  children: readonly LegacyAxGraphChild[];
  aliases: readonly LegacyAxGraphAlias[];
  bindings: readonly LegacyAxGraphBinding[];
}) {
  const hash = createHash("sha256");
  const orderedCollections = [
    ["parents", [...input.parents].sort((left, right) => compareUtf8(left.canonicalCode, right.canonicalCode))],
    ["children", [...input.children].sort((left, right) => compareUtf8(left.canonicalCode, right.canonicalCode))],
    ["aliases", [...input.aliases].sort((left, right) => compareUtf8(left.code, right.code))],
    [
      "bindings",
      [...input.bindings].sort((left, right) =>
        compareUtf8Tuple(
          [left.sourceProfileKey ?? "", left.stableRowKey],
          [right.sourceProfileKey ?? "", right.stableRowKey],
        ),
      ),
    ],
  ] as const;
  for (const [kind, rows] of orderedCollections) {
    hash.update(`${kind}\n`);
    for (const row of rows) hash.update(`${canonicalJson(row)}\n`);
  }
  return hash.digest("hex");
}

function auditChecksum(audits: readonly LegacyAxGraphAudit[]) {
  const hash = createHash("sha256");
  hash.update("audits\n");
  for (const audit of audits) hash.update(`${canonicalJson(audit)}\n`);
  return hash.digest("hex");
}

export function buildLegacyAxIdentityGraph(input: {
  manifest: LegacyAxIdentityGraphManifest;
  files: Readonly<Record<LegacyAxGraphFileKey, Buffer>>;
}): LegacyAxIdentityGraphPlan {
  const actualChecksums = {} as Record<LegacyAxGraphFileKey, string>;
  for (const key of LEGACY_AX_GRAPH_FILE_KEYS) {
    const body = input.files[key];
    if (!Buffer.isBuffer(body)) throw new Error(`Pinned legacy AX snapshot ${key} is missing.`);
    actualChecksums[key] = createHash("sha256").update(body).digest("hex");
    if (actualChecksums[key] !== input.manifest.files[key].sha256) {
      throw new Error(`Pinned legacy AX snapshot ${key} checksum does not match the manifest.`);
    }
  }
  if (!input.files.sharedUuidLedger.equals(input.files.tier1UuidLedger)) {
    throw new Error("The Tier 1 UUID copy is not byte-identical to the shared UUID ledger.");
  }

  const sharedUuidRows = parsePinnedRows(
    "sharedUuidLedger",
    input.files.sharedUuidLedger,
    UUID_HEADERS,
  );
  const tier1UuidRows = parsePinnedRows(
    "tier1UuidLedger",
    input.files.tier1UuidLedger,
    UUID_HEADERS,
  );
  const tier2UuidRows = parsePinnedRows(
    "tier2UuidLedger",
    input.files.tier2UuidLedger,
    UUID_HEADERS,
  );
  const sharedRop3Rows = parsePinnedRows(
    "sharedRop3Ledger",
    input.files.sharedRop3Ledger,
    ROP3_HEADERS,
  );
  const tier2Rop3Rows = parsePinnedRows(
    "tier2Rop3Ledger",
    input.files.tier2Rop3Ledger,
    ROP3_HEADERS,
  );
  const rowsByFile = {
    sharedUuidLedger: sharedUuidRows,
    tier1UuidLedger: tier1UuidRows,
    tier2UuidLedger: tier2UuidRows,
    sharedRop3Ledger: sharedRop3Rows,
    tier2Rop3Ledger: tier2Rop3Rows,
  } as const;
  for (const key of LEGACY_AX_GRAPH_FILE_KEYS) {
    assertExpectedCount(rowsByFile[key].length, input.manifest.files[key].rowCount, `${key} rows`);
  }
  if (sharedUuidRows.length !== tier1UuidRows.length) {
    throw new Error("The Tier 1 UUID copy does not match the shared UUID ledger.");
  }

  const sharedUuidSignatures = new Set(
    sharedUuidRows.map((row) => rowSignature(row, UUID_HEADERS)),
  );
  const tier2UuidSignatures = new Set(tier2UuidRows.map((row) => rowSignature(row, UUID_HEADERS)));
  if (
    tier2UuidSignatures.size !== tier2UuidRows.length ||
    tier2UuidRows.some((row) => !sharedUuidSignatures.has(rowSignature(row, UUID_HEADERS)))
  ) {
    throw new Error("The Tier 2 UUID ledger is not an exact subset of the shared UUID ledger.");
  }

  const sharedRop3Signatures = new Set(
    sharedRop3Rows.map((row) => rowSignature(row, ROP3_HEADERS)),
  );
  const tier2OnlyRop3Rows = tier2Rop3Rows.filter(
    (row) => !sharedRop3Signatures.has(rowSignature(row, ROP3_HEADERS)),
  );
  assertExpectedCount(
    tier2OnlyRop3Rows.length,
    input.manifest.expected.tier2Rop3UnionAddedRowCount,
    "Tier 2 ROP3 union additions",
  );

  const inputFingerprint = checksumValue({
    schemaVersion: input.manifest.schemaVersion,
    namespace: input.manifest.namespace,
    files: input.manifest.files,
    tier1SourceProfiles: input.manifest.tier1SourceProfiles,
    tier2Components: input.manifest.tier2Components,
    bindingTranslation: input.manifest.bindingTranslation,
  });
  const audits: LegacyAxGraphAudit[] = [];
  const occurrences: NormalizedOccurrence[] = [];
  const tier2Observed = new Map<string, number>();
  const allocatedValues = new Set<number>();

  for (const row of sharedUuidRows) {
    const source = sourceAssignment({
      row,
      ledgerKind: "uuid",
      sourceFileKey: "sharedUuidLedger",
      tier2UuidSignatures,
      uuidHeaders: UUID_HEADERS,
      manifest: input.manifest,
    });
    const normalized = normalizeUuidOccurrence({ row, source });
    if (allocatedValues.has(normalized.occurrence.allocatedValue!)) {
      throw new Error("The shared UUID ledger repeats a historical allocation value.");
    }
    allocatedValues.add(normalized.occurrence.allocatedValue!);
    occurrences.push(normalized.occurrence);
    if (normalized.shortPrimaryAudit) audits.push(normalized.shortPrimaryAudit);
    if (source.tier2Component) {
      tier2Observed.set(
        source.tier2Component,
        (tier2Observed.get(source.tier2Component) ?? 0) + 1,
      );
    }
  }

  const addRop3Occurrence = (
    row: LegacyAxRow,
    sourceFileKey: "sharedRop3Ledger" | "tier2Rop3Ledger",
  ) => {
    const source = sourceAssignment({
      row,
      ledgerKind: "rop3",
      sourceFileKey,
      tier2UuidSignatures,
      uuidHeaders: UUID_HEADERS,
      manifest: input.manifest,
    });
    occurrences.push(normalizeRop3Occurrence({ row, sourceFileKey, source }));
    if (source.tier2Component) {
      tier2Observed.set(
        source.tier2Component,
        (tier2Observed.get(source.tier2Component) ?? 0) + 1,
      );
    }
  };
  for (const row of sharedRop3Rows) addRop3Occurrence(row, "sharedRop3Ledger");
  for (const row of tier2OnlyRop3Rows) addRop3Occurrence(row, "tier2Rop3Ledger");

  const authorityByStableKey = new Map<string, NormalizedOccurrence>();
  const supersededAliases: LegacyAxGraphAlias[] = [];
  let crossLedgerMismatches = 0;
  for (const occurrence of occurrences) {
    const existing = authorityByStableKey.get(occurrence.stableRowKey);
    if (!existing) {
      authorityByStableKey.set(occurrence.stableRowKey, occurrence);
      continue;
    }
    if (existing.ledgerKind === occurrence.ledgerKind) {
      throw new Error("One legacy ledger repeats a stable source row key.");
    }
    const rop3 = occurrence.ledgerKind === "rop3" ? occurrence : existing;
    const uuid = occurrence.ledgerKind === "uuid" ? occurrence : existing;
    if (rop3.canonicalPgic !== uuid.canonicalPgic) {
      crossLedgerMismatches += 1;
      supersededAliases.push(
        {
          code: uuid.canonicalPgac,
          identityCanonicalCode: rop3.canonicalPgac,
          identityKind: "pgac",
        },
        {
          code: uuid.canonicalPgic,
          identityCanonicalCode: rop3.canonicalPgic,
          identityKind: "pgic",
        },
      );
      audits.push({
        auditKind: "cross-ledger-mismatch",
        sourceFileKey: rop3.sourceFileKey,
        stableRowKeyHash: stableRowKeyHash(rop3.stableRowKey),
        details: {
          uuidCanonicalCode: uuid.canonicalPgic,
          rop3CanonicalCode: rop3.canonicalPgic,
          historicalAllocatedValue: String(uuid.allocatedValue),
          resolution: "rop3-canonical-with-uuid-aliases",
        },
      });
    }
    authorityByStableKey.set(occurrence.stableRowKey, rop3);
  }

  const authoritativeOccurrences = [...authorityByStableKey.values()];
  const rawUnionPgacCount = new Set(occurrences.map((occurrence) => occurrence.canonicalPgac)).size;
  const rawUnionPgicCount = new Set(occurrences.map((occurrence) => occurrence.canonicalPgic)).size;
  assertExpectedCount(
    rawUnionPgacCount,
    input.manifest.expected.rawUnionPgacCount,
    "raw-union PGAC count",
  );
  assertExpectedCount(
    rawUnionPgicCount,
    input.manifest.expected.rawUnionPgicCount,
    "raw-union PGIC count",
  );
  assertExpectedCount(
    rawUnionPgacCount + rawUnionPgicCount,
    input.manifest.expected.rawUnionIdentityCount,
    "raw-union identity count",
  );
  assertExpectedCount(
    supersededAliases.length,
    input.manifest.expected.supersededCanonicalCodeCount,
    "superseded canonical code count",
  );
  const parentsByCode = new Map<string, LegacyAxGraphParent>();
  const childrenByCode = new Map<string, LegacyAxGraphChild>();
  for (const occurrence of authoritativeOccurrences) {
    const existingParent = parentsByCode.get(occurrence.canonicalPgac);
    if (!existingParent) {
      parentsByCode.set(occurrence.canonicalPgac, {
        canonicalCode: occurrence.canonicalPgac,
        allocatedValue: occurrence.allocatedValue,
        rop3Component:
          occurrence.ledgerKind === "rop3" ? sixDigitForPgac(occurrence.canonicalPgac) : null,
      });
    } else if (occurrence.ledgerKind === "rop3" && existingParent.allocatedValue !== null) {
      parentsByCode.set(occurrence.canonicalPgac, {
        canonicalCode: occurrence.canonicalPgac,
        allocatedValue: null,
        rop3Component: sixDigitForPgac(occurrence.canonicalPgac),
      });
    } else if (
      occurrence.ledgerKind === "uuid" &&
      existingParent.rop3Component === null &&
      existingParent.allocatedValue !== occurrence.allocatedValue
    ) {
      throw new Error("One canonical PGAC has conflicting historical allocation evidence.");
    }

    const existingChild = childrenByCode.get(occurrence.canonicalPgic);
    const child = {
      canonicalCode: occurrence.canonicalPgic,
      parentCanonicalCode: occurrence.canonicalPgac,
      normalizedIso3: occurrence.normalizedIso3,
    } as const;
    if (existingChild && canonicalJson(existingChild) !== canonicalJson(child)) {
      throw new Error("One canonical PGIC has conflicting parent evidence.");
    }
    childrenByCode.set(occurrence.canonicalPgic, child);
  }

  const canonicalOwners = new Map<
    string,
    Readonly<{ identityCanonicalCode: string; identityKind: "pgac" | "pgic" }>
  >();
  for (const parent of parentsByCode.values()) {
    canonicalOwners.set(parent.canonicalCode, {
      identityCanonicalCode: parent.canonicalCode,
      identityKind: "pgac",
    });
  }
  for (const child of childrenByCode.values()) {
    canonicalOwners.set(child.canonicalCode, {
      identityCanonicalCode: child.canonicalCode,
      identityKind: "pgic",
    });
  }
  const aliasesByCode = new Map<string, LegacyAxGraphAlias>();
  let quarantinedAliasConflicts = 0;
  const quarantinedAliasKeys = new Set<string>();
  for (const occurrence of authoritativeOccurrences) {
    for (const alias of occurrence.aliases) {
      if (!isStructurallyValidAxCode(alias)) {
        throw new Error("A legacy identity alias is structurally invalid.");
      }
      const identityKind: "pgac" | "pgic" =
        alias.split("-").length === 3 ? "pgac" : "pgic";
      const intendedIdentity =
        identityKind === "pgac" ? occurrence.canonicalPgac : occurrence.canonicalPgic;
      if (alias === intendedIdentity) continue;
      const canonicalOwner = canonicalOwners.get(alias);
      if (canonicalOwner && canonicalOwner.identityCanonicalCode !== intendedIdentity) {
        const quarantineKey = `${alias}:${intendedIdentity}`;
        if (!quarantinedAliasKeys.has(quarantineKey)) {
          quarantinedAliasKeys.add(quarantineKey);
          quarantinedAliasConflicts += 1;
          audits.push({
            auditKind: "alias-conflict-quarantined",
            sourceFileKey: occurrence.sourceFileKey,
            stableRowKeyHash: stableRowKeyHash(occurrence.stableRowKey),
            details: {
              alias,
              canonicalOwner: canonicalOwner.identityCanonicalCode,
              intendedIdentity,
              resolution: "canonical-owner-wins",
            },
          });
        }
        continue;
      }
      const candidate = { code: alias, identityCanonicalCode: intendedIdentity, identityKind };
      const existingAlias = aliasesByCode.get(alias);
      if (existingAlias && existingAlias.identityCanonicalCode !== intendedIdentity) {
        throw new Error("One legacy alias identifies multiple canonical subjects.");
      }
      aliasesByCode.set(alias, candidate);
    }
  }
  for (const alias of supersededAliases) {
    if (canonicalOwners.has(alias.code)) {
      throw new Error("A superseded UUID code is still owned by a canonical identity.");
    }
    const existingAlias = aliasesByCode.get(alias.code);
    if (existingAlias && existingAlias.identityCanonicalCode !== alias.identityCanonicalCode) {
      throw new Error("A superseded UUID code conflicts with another legacy alias.");
    }
    aliasesByCode.set(alias.code, alias);
  }

  const parents = [...parentsByCode.values()].sort((left, right) =>
    compareUtf8(left.canonicalCode, right.canonicalCode),
  );
  const children = [...childrenByCode.values()].sort((left, right) =>
    compareUtf8(left.canonicalCode, right.canonicalCode),
  );
  const aliases = [...aliasesByCode.values()].sort((left, right) =>
    compareUtf8(left.code, right.code),
  );
  const bindingsByCompositeKey = new Map<string, LegacyAxGraphBinding>();
  for (const occurrence of authorityByStableKey.values()) {
    const binding: LegacyAxGraphBinding = {
        sourceProfileKey: occurrence.sourceProfileKey,
        stableRowKey: occurrence.stableRowKey,
        identityCanonicalCode: occurrence.canonicalPgic,
        sourcePgacCode: occurrence.canonicalPgac,
        sourcePgicCode: occurrence.canonicalPgic,
        tier2Component: occurrence.tier2Component,
    };
    const compositeKey = `${occurrence.sourceProfileKey ?? "<unmapped>"}:${occurrence.stableRowKey}`;
    const existing = bindingsByCompositeKey.get(compositeKey);
    if (existing && existing.identityCanonicalCode !== binding.identityCanonicalCode) {
      throw new Error("One mapped source-profile row key identifies multiple canonical subjects.");
    }
    bindingsByCompositeKey.set(compositeKey, binding);
  }
  const historicalBindings = [...bindingsByCompositeKey.values()]
    .sort((left, right) =>
      compareUtf8Tuple(
        [left.sourceProfileKey ?? "", left.stableRowKey],
        [right.sourceProfileKey ?? "", right.stableRowKey],
      ),
    );
  const bindings: LegacyAxGraphBinding[] = [];

  assertExpectedCount(
    historicalBindings.length,
    input.manifest.expected.bindingCount,
    "historical binding count",
  );
  assertExpectedCount(parents.length, input.manifest.expected.pgacCount, "PGAC count");
  assertExpectedCount(children.length, input.manifest.expected.pgicCount, "PGIC count");
  assertExpectedCount(
    parents.length + children.length,
    input.manifest.expected.identityCount,
    "identity count",
  );
  const shortPrimaryNormalizations = audits.filter(
    (audit) => audit.auditKind === "short-primary-normalized",
  ).length;
  assertExpectedCount(
    shortPrimaryNormalizations,
    input.manifest.expected.shortPrimaryNormalizationCount,
    "short-primary normalization count",
  );
  assertExpectedCount(
    crossLedgerMismatches,
    input.manifest.expected.crossLedgerMismatchCount,
    "cross-ledger mismatch count",
  );
  assertExpectedCount(
    quarantinedAliasConflicts,
    input.manifest.expected.quarantinedAliasConflictCount,
    "quarantined alias conflict count",
  );
  assertExpectedCount(
    Math.max(...allocatedValues) + 1,
    input.manifest.expected.allocationCounterFloor,
    "allocation counter floor",
  );

  const blockingReasons: string[] = [];
  blockingReasons.push(
    "Cutover is blocked until exact source snapshots and a reviewed current-engine raw-to-runtime crosswalk select the active bindings.",
  );
  const componentNames = new Set([
    ...tier2Observed.keys(),
    ...Object.keys(input.manifest.tier2Components),
  ]);
  const tier2Components = [...componentNames]
    .sort(compareUtf8)
    .map((component) => {
      const observedRowCount = tier2Observed.get(component) ?? 0;
      const configured = input.manifest.tier2Components[component];
      if (!configured) {
        blockingReasons.push(`Tier 2 component ${component} is missing from the exact manifest.`);
      } else if (configured.expectedRowCount !== observedRowCount) {
        blockingReasons.push(`Tier 2 component ${component} row count does not match the manifest.`);
      }
      if (!configured?.profileKey) {
        blockingReasons.push(`Tier 2 component ${component} has no explicit profile mapping.`);
      }
      return {
        component,
        observedRowCount,
        expectedRowCount: configured?.expectedRowCount ?? null,
        profileKey: configured?.profileKey ?? null,
        mapped: Boolean(configured?.profileKey),
      };
    });
  if (historicalBindings.some((binding) => !binding.sourceProfileKey)) {
    blockingReasons.push("One or more source bindings have no explicit source-profile mapping.");
  }

  const sortedAudits = audits.sort((left, right) =>
    compareUtf8Tuple(
      [left.auditKind, left.sourceFileKey, left.stableRowKeyHash],
      [right.auditKind, right.sourceFileKey, right.stableRowKeyHash],
    ),
  );
  const computedGraphChecksum = computeLegacyAxIdentityGraphChecksum({
    parents,
    children,
    aliases,
    bindings,
  });
  const reportWithoutChecksum = {
    schemaVersion: 1 as const,
    inputFingerprint,
    graphChecksum: computedGraphChecksum,
    blocking: blockingReasons.length > 0,
    blockingReasons: [...new Set(blockingReasons)].sort(compareUtf8),
    files: Object.fromEntries(
      LEGACY_AX_GRAPH_FILE_KEYS.map((key) => [
        key,
        {
          relativePath: input.manifest.files[key].relativePath,
          sha256: actualChecksums[key],
          rowCount: rowsByFile[key].length,
        },
      ]),
    ) as LegacyAxIdentityGraphReport["files"],
    graph: {
      bindings: bindings.length,
      pgacIdentities: parents.length,
      pgicIdentities: children.length,
      identities: parents.length + children.length,
      aliases: aliases.length,
      allocationCounterFloor: input.manifest.expected.allocationCounterFloor,
    },
    reconciliation: {
      shortPrimaryNormalizations,
      crossLedgerMismatches,
      quarantinedAliasConflicts,
      tier2Rop3UnionAddedRows: tier2OnlyRop3Rows.length,
      rawUnionIdentities: rawUnionPgacCount + rawUnionPgicCount,
      supersededCanonicalCodes: supersededAliases.length,
    },
    audit: {
      records: sortedAudits.length,
      checksum: auditChecksum(sortedAudits),
      artifactChecksum: checksumValue(sortedAudits),
      decisions: sortedAudits,
    },
    bindingTranslation: {
      status: "blocked-pending-pinned-source-crosswalk",
      algorithmVersion: "source-forming-runtime-stable-row-key-v1",
      present: false,
      rawBindingCount: historicalBindings.length,
      selectedActiveBindingCount: 0,
      historicalUnboundCount: historicalBindings.length,
      sha256: null,
    },
    tier2Components,
  } satisfies LegacyAxIdentityGraphReport;
  const reportChecksum = checksumValue(reportWithoutChecksum);
  return {
    inputFingerprint,
    graphChecksum: computedGraphChecksum,
    reportChecksum,
    blocking: reportWithoutChecksum.blocking,
    parents,
    children,
    aliases,
    historicalBindings,
    bindings,
    audits: sortedAudits,
    report: reportWithoutChecksum,
  };
}
