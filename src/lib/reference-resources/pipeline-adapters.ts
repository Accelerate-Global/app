import {
  getImbFieldContractChecksum,
  getImbTransformationChecksum,
} from "@/lib/imb-forming/engine";
import {
  IMB_FIELD_CONTRACT,
  IMB_FIELD_CONTRACT_VERSION,
  IMB_FORMING_TRANSFORMATION_VERSION,
} from "@/lib/imb-forming/field-contract";

import {
  canonicalizeReferenceResource,
  checksumReferenceResource,
} from "./canonical";
import {
  ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
  JP_PEOPLE_ID3_RESOURCE_KEY,
  PEID_RESOURCE_KEY,
  PIPELINE_RESOURCE_SCHEMA_VERSION,
  SOURCE_ALIASES_RESOURCE_KEY,
  TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
  engagementMappingsResourceSchema,
  jpPeopleId3ResourceSchema,
  peidResourceSchema,
  sourceAliasResourceSchema,
  tier1MergePrioritiesResourceSchema,
  type EngagementMappingRow,
  type JpPeopleId3Row,
  type PeidRow,
  type PipelineCodeContract,
  type PipelineCodeContractKind,
  type PipelineResourceKey,
  type PipelineResourcePayloadByKey,
  type PipelineResourceValidationContext,
  type PipelineResourceValidationFinding,
  type PipelineResourceValidationResult,
  type PreparedPipelineResource,
  type PreparedPipelineResourceEntry,
  type SourceAliasRow,
  type Tier1MergePriorityRow,
} from "./pipeline-types";

const CONTRACT_KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const CONTRACT_VERSION_PATTERN = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/u;
const CONTRACT_CHECKSUM_PATTERN = /^[a-f0-9]{64}$/u;

export class PipelineResourceValidationError extends Error {
  constructor(
    message: string,
    readonly findings: readonly PipelineResourceValidationFinding[],
  ) {
    super(message);
    this.name = "PipelineResourceValidationError";
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function normalizeText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function normalizeAlias(value: string) {
  return normalizeText(value).toLocaleLowerCase();
}

function finding(
  input: Omit<PipelineResourceValidationFinding, "details"> & {
    details?: Readonly<Record<string, unknown>>;
  },
): PipelineResourceValidationFinding {
  return deepFreeze({ ...input, details: input.details ?? {} });
}

function schemaFindings(
  resourceKey: PipelineResourceKey,
  issues: readonly { path: PropertyKey[]; message: string }[],
) {
  return issues.map((issue) =>
    finding({
      severity: "error",
      ruleCode: "invalid-resource-schema",
      message: `${resourceKey} ${issue.path.join(".") || "payload"}: ${issue.message}`,
      stableEntryKey: null,
      fieldName: issue.path.length > 0 ? String(issue.path.at(-1)) : null,
    }),
  );
}

function duplicateFinding(input: {
  ruleCode: string;
  label: string;
  value: string;
  stableEntryKey: string;
  fieldName: string;
}) {
  return finding({
    severity: "error",
    ruleCode: input.ruleCode,
    message: `${input.label} ${input.value} is duplicated.`,
    stableEntryKey: input.stableEntryKey,
    fieldName: input.fieldName,
    details: { duplicateValue: input.value },
  });
}

function validateUnique(input: {
  rows: readonly { stableKey: string }[];
  value: (row: { stableKey: string }) => string;
  ruleCode: string;
  label: string;
  fieldName: string;
}) {
  const findings: PipelineResourceValidationFinding[] = [];
  const seen = new Set<string>();
  for (const row of input.rows) {
    const value = input.value(row);
    if (seen.has(value)) {
      findings.push(
        duplicateFinding({
          ruleCode: input.ruleCode,
          label: input.label,
          value,
          stableEntryKey: row.stableKey,
          fieldName: input.fieldName,
        }),
      );
    }
    seen.add(value);
  }
  return findings;
}

function activeStateFindings<Key extends PipelineResourceKey>(
  resourceKey: Key,
  entries: readonly PreparedPipelineResourceEntry<Key>[],
) {
  if (entries.some((entry) => entry.active)) return [];
  return [
    finding({
      severity: "error",
      ruleCode: "resource-has-no-active-entries",
      message: `${resourceKey} must contain at least one active entry.`,
      stableEntryKey: null,
      fieldName: "active",
    }),
  ];
}

function prepareSourceAliases(payload: PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY]) {
  const entries = payload.entries
    .map((entry) =>
      deepFreeze({
        ...entry,
        displayName: normalizeText(entry.displayName),
        aliases: [...new Set(entry.aliases.map(normalizeText))].sort((left, right) =>
          normalizeAlias(left).localeCompare(normalizeAlias(right)),
        ),
        stableKey: `source:${entry.canonicalSourceKey}`,
      }),
    )
    .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  const findings = [
    ...activeStateFindings(SOURCE_ALIASES_RESOURCE_KEY, entries),
    ...validateUnique({
      rows: entries,
      value: (row) => row.stableKey,
      ruleCode: "duplicate-source-key",
      label: "Canonical source key",
      fieldName: "canonicalSourceKey",
    }),
    ...validateUnique({
      rows: entries,
      value: (row) => (row as (typeof entries)[number]).fieldId,
      ruleCode: "duplicate-field-id",
      label: "Field ID",
      fieldName: "fieldId",
    }),
    ...validateUnique({
      rows: entries,
      value: (row) => (row as (typeof entries)[number]).initials,
      ruleCode: "duplicate-source-initials",
      label: "Source initials",
      fieldName: "initials",
    }),
  ];
  for (const entry of payload.entries) {
    const seenAliases = new Set<string>();
    for (const value of entry.aliases) {
      const alias = normalizeAlias(value);
      if (seenAliases.has(alias)) {
        findings.push(
          duplicateFinding({
            ruleCode: "duplicate-source-alias",
            label: "Source alias",
            value,
            stableEntryKey: `source:${entry.canonicalSourceKey}`,
            fieldName: "aliases",
          }),
        );
      }
      seenAliases.add(alias);
    }
  }
  const aliases = new Map<string, string>();
  for (const entry of entries) {
    for (const value of [entry.displayName, entry.initials, ...entry.aliases]) {
      const alias = normalizeAlias(value);
      const owner = aliases.get(alias);
      if (owner && owner !== entry.canonicalSourceKey) {
        findings.push(
          finding({
            severity: "error",
            ruleCode: "ambiguous-source-alias",
            message: `Source alias ${value} belongs to both ${owner} and ${entry.canonicalSourceKey}.`,
            stableEntryKey: entry.stableKey,
            fieldName: "aliases",
            details: { alias, owners: [owner, entry.canonicalSourceKey] },
          }),
        );
      } else {
        aliases.set(alias, entry.canonicalSourceKey);
      }
    }
  }
  return { entries, findings };
}

function crosswalkFindings<Row extends JpPeopleId3Row | PeidRow>(input: {
  entries: readonly (Row & { stableKey: string })[];
  context: PipelineResourceValidationContext;
  identifierField: "peopleId3" | "peid";
}) {
  const findings: PipelineResourceValidationFinding[] = [];
  for (const entry of input.entries) {
    if (entry.parentStatus === "approved-missing") {
      if (entry.rop3 || !entry.missingParentReason) {
        findings.push(
          finding({
            severity: "error",
            ruleCode: "invalid-approved-missing-parent",
            message: `${entry.stableKey} must omit ROP3 and include a reason when its parent is approved missing.`,
            stableEntryKey: entry.stableKey,
            fieldName: "parentStatus",
          }),
        );
      } else {
        findings.push(
          finding({
            severity: "warning",
            ruleCode: "approved-bounded-missing-parent",
            message: `${entry.stableKey} has a reviewed missing ROP3 parent.`,
            stableEntryKey: entry.stableKey,
            fieldName: "rop3",
            details: { reason: entry.missingParentReason },
          }),
        );
      }
    } else if (!entry.rop3 || entry.missingParentReason) {
      findings.push(
        finding({
          severity: "error",
          ruleCode: "missing-required-parent",
          message: `${entry.stableKey} must reference a ROP3 code when its parent status is linked.`,
          stableEntryKey: entry.stableKey,
          fieldName: "rop3",
        }),
      );
    }

    if (
      entry.rop3 &&
      input.context.knownRop3Codes &&
      !input.context.knownRop3Codes.has(entry.rop3)
    ) {
      findings.push(
        finding({
          severity: "error",
          ruleCode: "unknown-rop3-reference",
          message: `${entry.stableKey} references unknown ROP3 ${entry.rop3}.`,
          stableEntryKey: entry.stableKey,
          fieldName: "rop3",
        }),
      );
    }
    if (
      entry.iso3 &&
      input.context.knownIso3Codes &&
      !input.context.knownIso3Codes.has(entry.iso3)
    ) {
      findings.push(
        finding({
          severity: "error",
          ruleCode: "unknown-iso3-reference",
          message: `${entry.stableKey} references unknown ISO3 ${entry.iso3}.`,
          stableEntryKey: entry.stableKey,
          fieldName: "iso3",
        }),
      );
    }
    if (
      "rop1" in entry &&
      entry.rop1 &&
      input.context.knownRop1Codes &&
      !input.context.knownRop1Codes.has(entry.rop1)
    ) {
      findings.push(
        finding({
          severity: "error",
          ruleCode: "unknown-rop1-reference",
          message: `${entry.stableKey} references unknown ROP1 ${entry.rop1}.`,
          stableEntryKey: entry.stableKey,
          fieldName: "rop1",
        }),
      );
    }
  }
  findings.push(
    ...validateUnique({
      rows: input.entries,
      value: (row) =>
        String(
          (row as unknown as Row & Record<string, unknown>)[
            input.identifierField
          ],
        ),
      ruleCode: `duplicate-${input.identifierField.toLocaleLowerCase()}`,
      label: input.identifierField,
      fieldName: input.identifierField,
    }),
  );
  return findings;
}

function prepareJpPeopleId3(
  payload: PipelineResourcePayloadByKey[typeof JP_PEOPLE_ID3_RESOURCE_KEY],
  context: PipelineResourceValidationContext,
) {
  const entries = payload.entries
    .map((entry) => deepFreeze({ ...entry, stableKey: `peopleid3:${entry.peopleId3}` }))
    .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  return {
    entries,
    findings: [
      ...activeStateFindings(JP_PEOPLE_ID3_RESOURCE_KEY, entries),
      ...crosswalkFindings({ entries, context, identifierField: "peopleId3" }),
    ],
  };
}

function preparePeid(
  payload: PipelineResourcePayloadByKey[typeof PEID_RESOURCE_KEY],
  context: PipelineResourceValidationContext,
) {
  const entries = payload.entries
    .map((entry) =>
      deepFreeze({
        ...entry,
        peopleName: normalizeText(entry.peopleName),
        stableKey: `peid:${entry.peid}`,
      }),
    )
    .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  const findings = [
    ...activeStateFindings(PEID_RESOURCE_KEY, entries),
    ...crosswalkFindings({ entries, context, identifierField: "peid" }),
  ];
  for (const entry of entries) {
    if (entry.parentStatus === "linked" && !entry.rop1) {
      findings.push(
        finding({
          severity: "warning",
          ruleCode: "missing-rop1-cross-reference",
          message: `${entry.stableKey} has no current ROP1 cross-reference; its valid ROP3 relationship is retained.`,
          stableEntryKey: entry.stableKey,
          fieldName: "rop1",
        }),
      );
    }
  }
  return { entries, findings };
}

function prepareTier1Priorities(
  payload: PipelineResourcePayloadByKey[typeof TIER1_MERGE_PRIORITIES_RESOURCE_KEY],
  context: PipelineResourceValidationContext,
) {
  const entries = payload.entries
    .map((entry) =>
      deepFreeze({
        ...entry,
        displayName: normalizeText(entry.displayName),
        prioritySourceKeys: [...entry.prioritySourceKeys],
        stableKey: `tier1-priority:${entry.canonicalField}`,
      }),
    )
    .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  const findings = [
    ...activeStateFindings(TIER1_MERGE_PRIORITIES_RESOURCE_KEY, entries),
    ...validateUnique({
      rows: entries,
      value: (row) => row.stableKey,
      ruleCode: "duplicate-priority-field",
      label: "Priority field",
      fieldName: "canonicalField",
    }),
    ...validateUnique({
      rows: entries,
      value: (row) => (row as (typeof entries)[number]).fieldId,
      ruleCode: "duplicate-field-id",
      label: "Field ID",
      fieldName: "fieldId",
    }),
  ];
  for (const entry of entries) {
    if (entry.active && entry.prioritySourceKeys.length === 0) {
      findings.push(
        finding({
          severity: "warning",
          ruleCode: "active-priority-has-no-sources",
          message: `${entry.canonicalField} is active but has no source priority; merge selection will leave it unset.`,
          stableEntryKey: entry.stableKey,
          fieldName: "prioritySourceKeys",
        }),
      );
    }
    const seen = new Set<string>();
    for (const sourceKey of entry.prioritySourceKeys) {
      if (seen.has(sourceKey)) {
        findings.push(
          duplicateFinding({
            ruleCode: "duplicate-priority-source",
            label: "Priority source",
            value: sourceKey,
            stableEntryKey: entry.stableKey,
            fieldName: "prioritySourceKeys",
          }),
        );
      }
      seen.add(sourceKey);
      if (context.knownSourceKeys && !context.knownSourceKeys.has(sourceKey)) {
        findings.push(
          finding({
            severity: "error",
            ruleCode: "unknown-priority-source",
            message: `${entry.canonicalField} references unknown source ${sourceKey}.`,
            stableEntryKey: entry.stableKey,
            fieldName: "prioritySourceKeys",
          }),
        );
      } else if (
        entry.active &&
        context.activeSourceKeys &&
        !context.activeSourceKeys.has(sourceKey)
      ) {
        findings.push(
          finding({
            severity: "error",
            ruleCode: "inactive-priority-source",
            message: `${entry.canonicalField} references inactive source ${sourceKey}.`,
            stableEntryKey: entry.stableKey,
            fieldName: "prioritySourceKeys",
          }),
        );
      }
    }
  }
  return { entries, findings };
}

function prepareEngagementMappings(
  payload: PipelineResourcePayloadByKey[typeof ENGAGEMENT_MAPPINGS_RESOURCE_KEY],
) {
  const entries = payload.entries
    .map((entry) =>
      deepFreeze({
        ...entry,
        sourceField: normalizeText(entry.sourceField),
        displayName: normalizeText(entry.displayName),
        stableKey: `engagement-field:${entry.canonicalField}`,
      }),
    )
    .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  return {
    entries,
    findings: [
      ...activeStateFindings(ENGAGEMENT_MAPPINGS_RESOURCE_KEY, entries),
      ...validateUnique({
        rows: entries,
        value: (row) => row.stableKey,
        ruleCode: "duplicate-engagement-field",
        label: "Engagement field",
        fieldName: "canonicalField",
      }),
      ...validateUnique({
        rows: entries,
        value: (row) => (row as (typeof entries)[number]).fieldId,
        ruleCode: "duplicate-field-id",
        label: "Field ID",
        fieldName: "fieldId",
      }),
      ...validateUnique({
        rows: entries,
        value: (row) => normalizeAlias(
          (row as (typeof entries)[number]).sourceField,
        ),
        ruleCode: "duplicate-engagement-source-field",
        label: "Engagement source field",
        fieldName: "sourceField",
      }),
    ],
  };
}

function parsePipelineResource<Key extends PipelineResourceKey>(
  resourceKey: Key,
  value: unknown,
):
  | { success: true; data: PipelineResourcePayloadByKey[Key] }
  | { success: false; findings: PipelineResourceValidationFinding[] } {
  const result = (() => {
    switch (resourceKey) {
      case SOURCE_ALIASES_RESOURCE_KEY:
        return sourceAliasResourceSchema.safeParse(value);
      case JP_PEOPLE_ID3_RESOURCE_KEY:
        return jpPeopleId3ResourceSchema.safeParse(value);
      case PEID_RESOURCE_KEY:
        return peidResourceSchema.safeParse(value);
      case TIER1_MERGE_PRIORITIES_RESOURCE_KEY:
        return tier1MergePrioritiesResourceSchema.safeParse(value);
      case ENGAGEMENT_MAPPINGS_RESOURCE_KEY:
        return engagementMappingsResourceSchema.safeParse(value);
    }
  })();
  if (!result.success) {
    return {
      success: false,
      findings: schemaFindings(resourceKey, result.error.issues),
    };
  }
  return {
    success: true,
    data: result.data as unknown as PipelineResourcePayloadByKey[Key],
  };
}

function normalizePipelineEntries<Key extends PipelineResourceKey>(
  resourceKey: Key,
  payload: PipelineResourcePayloadByKey[Key],
  context: PipelineResourceValidationContext,
) {
  switch (resourceKey) {
    case SOURCE_ALIASES_RESOURCE_KEY:
      return prepareSourceAliases(
        payload as PipelineResourcePayloadByKey[typeof SOURCE_ALIASES_RESOURCE_KEY],
      );
    case JP_PEOPLE_ID3_RESOURCE_KEY:
      return prepareJpPeopleId3(
        payload as PipelineResourcePayloadByKey[typeof JP_PEOPLE_ID3_RESOURCE_KEY],
        context,
      );
    case PEID_RESOURCE_KEY:
      return preparePeid(
        payload as PipelineResourcePayloadByKey[typeof PEID_RESOURCE_KEY],
        context,
      );
    case TIER1_MERGE_PRIORITIES_RESOURCE_KEY:
      return prepareTier1Priorities(
        payload as PipelineResourcePayloadByKey[typeof TIER1_MERGE_PRIORITIES_RESOURCE_KEY],
        context,
      );
    case ENGAGEMENT_MAPPINGS_RESOURCE_KEY:
      return prepareEngagementMappings(
        payload as PipelineResourcePayloadByKey[typeof ENGAGEMENT_MAPPINGS_RESOURCE_KEY],
      );
  }
}

function escapeCsvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  return `${[
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n")}\n`;
}

export function serializePipelineResourceCsv<Key extends PipelineResourceKey>(
  resourceKey: Key,
  entries: readonly PreparedPipelineResourceEntry<Key>[],
) {
  switch (resourceKey) {
    case SOURCE_ALIASES_RESOURCE_KEY:
      return buildCsv(
        ["Stable key", "Field ID", "Source key", "Database name", "Initials", "Aliases", "Active"],
        (entries as readonly (SourceAliasRow & { stableKey: string })[]).map((entry) => [
          entry.stableKey,
          entry.fieldId,
          entry.canonicalSourceKey,
          entry.displayName,
          entry.initials,
          entry.aliases.join("; "),
          entry.active ? "TRUE" : "FALSE",
        ]),
      );
    case JP_PEOPLE_ID3_RESOURCE_KEY:
      return buildCsv(
        ["Stable key", "PeopleID3", "ROP3", "ISO3", "Active", "Parent status", "Missing parent reason"],
        (entries as readonly (JpPeopleId3Row & { stableKey: string })[]).map((entry) => [
          entry.stableKey,
          entry.peopleId3,
          entry.rop3,
          entry.iso3,
          entry.active ? "TRUE" : "FALSE",
          entry.parentStatus,
          entry.missingParentReason,
        ]),
      );
    case PEID_RESOURCE_KEY:
      return buildCsv(
        ["Stable key", "PEID", "People name", "ISO3", "ROP3", "ROP1", "Active", "Parent status", "Missing parent reason"],
        (entries as readonly (PeidRow & { stableKey: string })[]).map((entry) => [
          entry.stableKey,
          entry.peid,
          entry.peopleName,
          entry.iso3,
          entry.rop3,
          entry.rop1,
          entry.active ? "TRUE" : "FALSE",
          entry.parentStatus,
          entry.missingParentReason,
        ]),
      );
    case TIER1_MERGE_PRIORITIES_RESOURCE_KEY:
      return buildCsv(
        ["Stable key", "Field ID", "Canonical field", "Display name", "Active", "Priorities"],
        (entries as readonly (Tier1MergePriorityRow & { stableKey: string })[]).map((entry) => [
          entry.stableKey,
          entry.fieldId,
          entry.canonicalField,
          entry.displayName,
          entry.active ? "TRUE" : "FALSE",
          entry.prioritySourceKeys.join("; "),
        ]),
      );
    case ENGAGEMENT_MAPPINGS_RESOURCE_KEY:
      return buildCsv(
        ["Stable key", "Field ID", "Source field", "Canonical field", "Display name", "Active", "Data type"],
        (entries as readonly (EngagementMappingRow & { stableKey: string })[]).map((entry) => [
          entry.stableKey,
          entry.fieldId,
          entry.sourceField,
          entry.canonicalField,
          entry.displayName,
          entry.active ? "TRUE" : "FALSE",
          entry.dataType,
        ]),
      );
  }
}

export function validatePipelineResource<Key extends PipelineResourceKey>(
  resourceKey: Key,
  value: unknown,
  context: PipelineResourceValidationContext = {},
): PipelineResourceValidationResult<Key> {
  const parsed = parsePipelineResource(resourceKey, value);
  if (!parsed.success) {
    return deepFreeze({ valid: false, resource: null, findings: parsed.findings });
  }
  const normalized = normalizePipelineEntries(resourceKey, parsed.data, context);
  const entries = normalized.entries as unknown as readonly PreparedPipelineResourceEntry<Key>[];
  const findings = normalized.findings;
  if (findings.some((item) => item.severity === "error")) {
    return deepFreeze({ valid: false, resource: null, findings });
  }

  const content = {
    resourceKey,
    schemaVersion: PIPELINE_RESOURCE_SCHEMA_VERSION,
    entries,
  };
  const resource: PreparedPipelineResource<Key> = deepFreeze({
    resourceKey,
    schemaVersion: PIPELINE_RESOURCE_SCHEMA_VERSION,
    sourceName: parsed.data.sourceName,
    sourceRetrievedAt: parsed.data.sourceRetrievedAt,
    entries,
    entryCount: entries.length,
    contentChecksum: checksumReferenceResource(content),
    csv: serializePipelineResourceCsv(resourceKey, entries),
    findings,
    valid: true,
  });
  return deepFreeze({ valid: true, resource, findings });
}

export function preparePipelineResource<Key extends PipelineResourceKey>(
  resourceKey: Key,
  value: unknown,
  context: PipelineResourceValidationContext = {},
) {
  const result = validatePipelineResource(resourceKey, value, context);
  if (!result.valid || !result.resource) {
    throw new PipelineResourceValidationError(
      `Pipeline resource ${resourceKey} is invalid.`,
      result.findings,
    );
  }
  return result.resource;
}

export function canonicalizePipelineResource<Key extends PipelineResourceKey>(
  resource: PreparedPipelineResource<Key>,
) {
  return canonicalizeReferenceResource({
    resourceKey: resource.resourceKey,
    schemaVersion: resource.schemaVersion,
    entries: resource.entries,
  });
}

export function createPipelineCodeContract(input: {
  key: string;
  kind: PipelineCodeContractKind;
  version: string;
  definition: Readonly<Record<string, unknown>>;
  checksum?: string;
}): PipelineCodeContract {
  if (!CONTRACT_KEY_PATTERN.test(input.key)) {
    throw new Error(`Pipeline code contract key ${input.key} is invalid.`);
  }
  if (!CONTRACT_VERSION_PATTERN.test(input.version)) {
    throw new Error(`Pipeline code contract ${input.key} has an invalid version.`);
  }
  if (input.checksum && !CONTRACT_CHECKSUM_PATTERN.test(input.checksum)) {
    throw new Error(`Pipeline code contract ${input.key} has an invalid checksum.`);
  }
  const definition = deepFreeze(structuredClone(input.definition));
  const checksum =
    input.checksum ??
    checksumReferenceResource({
      key: input.key,
      kind: input.kind,
      version: input.version,
      definition,
    });
  return deepFreeze({
    key: input.key,
    kind: input.kind,
    version: input.version,
    definition,
    checksum,
  });
}

export function createPipelineCodeContractRegistry(
  contracts: readonly PipelineCodeContract[],
) {
  const byKey = new Map<string, PipelineCodeContract>();
  for (const contract of contracts) {
    if (byKey.has(contract.key)) {
      throw new Error(`Pipeline code contract ${contract.key} is registered more than once.`);
    }
    byKey.set(contract.key, contract);
  }
  const sorted = deepFreeze(
    [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key)),
  );
  return deepFreeze({
    contracts: sorted,
    get(key: string) {
      return byKey.get(key) ?? null;
    },
  });
}

const imbFieldContract = createPipelineCodeContract({
  key: "imb-field-contract",
  kind: "field-contract",
  version: String(IMB_FIELD_CONTRACT_VERSION),
  definition: {
    legacyChecksum: getImbFieldContractChecksum(),
    fields: IMB_FIELD_CONTRACT,
  },
  checksum: getImbFieldContractChecksum(),
});

const imbTransformationContract = createPipelineCodeContract({
  key: "imb-forming-transformation",
  kind: "transformation-contract",
  version: IMB_FORMING_TRANSFORMATION_VERSION,
  definition: {
    legacyChecksum: getImbTransformationChecksum(),
    fieldContractKey: imbFieldContract.key,
    fieldContractChecksum: imbFieldContract.checksum,
    countryRulesVersion: 1,
    ropRulesVersion: 1,
    conversionRulesVersion: 1,
    identityRulesVersion: 1,
  },
  checksum: getImbTransformationChecksum(),
});

export const PIPELINE_CODE_CONTRACT_REGISTRY =
  createPipelineCodeContractRegistry([
    imbFieldContract,
    imbTransformationContract,
  ]);
