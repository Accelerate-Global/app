import { normalizeHeaders } from "@/lib/csv";
import type { DatasetFormingFinding } from "@/lib/dataset-forming/types";
import type { PipelineSemanticType } from "@/lib/reference-resources/pipeline-types";
import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";
import {
  convertSourceValue,
  createCountryReferenceIndex,
  createFinding,
  createRopReferenceIndex,
  createSourceColumnIndex,
  createStableSourceRowKey,
  groupDuplicateIndexes,
  normalizeIdentifier,
  resolveCountryReference,
} from "@/lib/source-forming/primitives";
import type { SourceSemanticType } from "@/lib/source-forming/types";

import { validateTier2PartnerProfileConfig } from "./profiles";
import {
  resolveTier2PartnerSourceAlias,
  validateTier2PartnerResources,
} from "./resources";
import type {
  Tier2FormingInput,
  Tier2FormingResult,
  Tier2FormingValidation,
  Tier2IdentityEvidence,
} from "./types";

const SYSTEM_FIELDS = [
  "Data_Source",
  "Dataset_ID",
  "Dataset_Row_ID",
  "Dataset_Row_Key",
  "Tier2_Profile_Key",
  "Tier2_Partner_Key",
  "Tier2_Tracking_ID_Source",
  "Tier2_Tracking_ID",
  "Source_PG_ROP3_Evidence",
  "Crosswalk_PG_ROP3_Evidence",
  "Crosswalk_Geo_ISO3_Evidence",
  "Provider_Native_Identity",
  "PG_PeopleID3",
  "PG_PEID",
  "PG_ROP1",
  "PG_ROP2",
  "PG_ROP25",
  "PG_ROP3",
  "Geo_Country_Name",
  "Geo_ISO3",
] as const;

function toSourceType(type: PipelineSemanticType): SourceSemanticType {
  if (type === "date") return "datetime";
  return type;
}

function fieldIdOrder(value: string) {
  return Number(value.match(/\d+/u)?.[0] ?? Number.MAX_SAFE_INTEGER);
}

function outputLabels(input: Tier2FormingInput) {
  const mappingLabels = input.resources.engagementMappings
    .filter((entry) => entry.active)
    .toSorted(
      (left, right) =>
        fieldIdOrder(left.fieldId) - fieldIdOrder(right.fieldId) ||
        left.canonicalField.localeCompare(right.canonicalField),
    )
    .map((entry) => entry.canonicalField);
  return [...new Set([...mappingLabels, ...SYSTEM_FIELDS])];
}

function finding(
  severity: "warning" | "error",
  ruleCode: string,
  sourceRowIndex: number | null,
  stableRowKey: string | null,
  fieldName: string | null,
  sourceValue: string | null,
  canonicalValue: string | null,
  message: string,
  details: Record<string, unknown> = {},
) {
  return createFinding({
    severity,
    ruleCode,
    sourceRowIndex,
    stableRowKey,
    fieldName,
    sourceValue,
    canonicalValue,
    message,
    details,
  });
}

function createActiveIndex<T>(
  rows: readonly T[],
  isActive: (row: T) => boolean,
  keyFor: (row: T) => string,
) {
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    if (!isActive(row)) continue;
    const key = normalizeIdentifier(keyFor(row));
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  return byKey;
}

function setValue(
  row: Record<string, string>,
  keys: ReadonlyMap<string, string>,
  label: string,
  value: string,
) {
  const key = keys.get(label);
  if (key) row[key] = value;
}

function getValue(
  row: Readonly<Record<string, string>>,
  keys: ReadonlyMap<string, string>,
  label: string,
) {
  const key = keys.get(label);
  return key ? row[key] ?? "" : "";
}

function resolveTracking(input: {
  forming: Tier2FormingInput;
  sourceRow: Readonly<Record<string, string>>;
  sourceColumns: ReturnType<typeof createSourceColumnIndex>;
  row: Record<string, string>;
  outputKeys: ReadonlyMap<string, string>;
  rowIndex: number;
  stableRowKey: string;
  peopleId3: ReturnType<typeof createActiveIndex<Tier2FormingInput["resources"]["peopleId3Entries"][number]>>;
  peids: ReturnType<typeof createActiveIndex<Tier2FormingInput["resources"]["peidEntries"][number]>>;
  findings: DatasetFormingFinding[];
}) {
  const profile = input.forming.profile;
  const trackingId = normalizeIdentifier(
    input.sourceColumns.value(input.sourceRow, profile.trackingIdColumn),
  );
  setValue(input.row, input.outputKeys, "Tier2_Tracking_ID", trackingId);
  setValue(
    input.row,
    input.outputKeys,
    "Tier2_Tracking_ID_Source",
    profile.trackingIdSource,
  );

  if (!trackingId) {
    input.findings.push(
      finding(
        "error",
        "missing-tracking-id",
        input.rowIndex,
        input.stableRowKey,
        profile.trackingIdColumn,
        "",
        null,
        "The configured tracking identifier is blank.",
      ),
    );
    return { trackingId, rop3: "", iso3: "", ambiguous: false };
  }

  if (profile.trackingIdSource === "provider-native") {
    setValue(input.row, input.outputKeys, "Provider_Native_Identity", trackingId);
    return { trackingId, rop3: "", iso3: "", ambiguous: false };
  }
  if (profile.trackingIdSource === "rop3") {
    return { trackingId, rop3: trackingId, iso3: "", ambiguous: false };
  }

  const matches =
    profile.trackingIdSource === "peopleid3"
      ? input.peopleId3.get(trackingId) ?? []
      : input.peids.get(trackingId) ?? [];
  if (matches.length !== 1) {
    input.findings.push(
      finding(
        "error",
        matches.length > 1 ? "ambiguous-tracking-id" : "unresolved-tracking-id",
        input.rowIndex,
        input.stableRowKey,
        profile.trackingIdColumn,
        trackingId,
        null,
        matches.length > 1
          ? "The pinned crosswalk returns more than one active match."
          : "The pinned crosswalk does not contain this tracking identifier.",
        { trackingIdSource: profile.trackingIdSource, matchCount: matches.length },
      ),
    );
    return { trackingId, rop3: "", iso3: "", ambiguous: matches.length > 1 };
  }

  const match = matches[0]!;
  if (profile.trackingIdSource === "peopleid3") {
    setValue(input.row, input.outputKeys, "PG_PeopleID3", trackingId);
  } else {
    setValue(input.row, input.outputKeys, "PG_PEID", trackingId);
  }
  return {
    trackingId,
    rop3: match.rop3 ?? "",
    iso3: match.iso3?.toUpperCase() ?? "",
    ambiguous: false,
  };
}

function applyRop(input: {
  forming: Tier2FormingInput;
  sourceRow: Readonly<Record<string, string>>;
  sourceColumns: ReturnType<typeof createSourceColumnIndex>;
  row: Record<string, string>;
  outputKeys: ReadonlyMap<string, string>;
  rowIndex: number;
  stableRowKey: string;
  crosswalkRop3: string;
  ropIndex: ReturnType<typeof createRopReferenceIndex>;
  findings: DatasetFormingFinding[];
}) {
  const configuredSourceRop3 = input.forming.profile.sourceRop3Column
    ? input.sourceColumns.value(
        input.sourceRow,
        input.forming.profile.sourceRop3Column,
      )
    : "";
  const mappedSourceRop3 = getValue(input.row, input.outputKeys, "PG_ROP3");
  const sourceRop3 = normalizeIdentifier(
    configuredSourceRop3 || mappedSourceRop3,
  );
  const crosswalkRop3 = normalizeIdentifier(input.crosswalkRop3);
  setValue(input.row, input.outputKeys, "Source_PG_ROP3_Evidence", sourceRop3);
  setValue(
    input.row,
    input.outputKeys,
    "Crosswalk_PG_ROP3_Evidence",
    crosswalkRop3,
  );

  const sourceMatch = sourceRop3
    ? input.ropIndex.byRop3.get(sourceRop3) ?? null
    : null;
  const crosswalkMatch = crosswalkRop3
    ? input.ropIndex.byRop3.get(crosswalkRop3) ?? null
    : null;
  if (
    sourceRop3 &&
    (!sourceMatch || input.ropIndex.conflictingRop3.has(sourceRop3))
  ) {
    setValue(input.row, input.outputKeys, "PG_ROP3", "");
    input.findings.push(
      finding(
        "error",
        "invalid-source-rop3",
        input.rowIndex,
        input.stableRowKey,
        "PG_ROP3",
        sourceRop3,
        null,
        "The source ROP3 does not resolve exactly in the pinned taxonomy.",
      ),
    );
    return false;
  }
  if (
    crosswalkRop3 &&
    (!crosswalkMatch || input.ropIndex.conflictingRop3.has(crosswalkRop3))
  ) {
    setValue(input.row, input.outputKeys, "PG_ROP3", "");
    input.findings.push(
      finding(
        "error",
        "invalid-crosswalk-rop3",
        input.rowIndex,
        input.stableRowKey,
        "PG_ROP3",
        crosswalkRop3,
        null,
        "The tracking crosswalk ROP3 does not resolve exactly in the pinned taxonomy.",
      ),
    );
    return false;
  }
  if (sourceRop3 && crosswalkRop3 && sourceRop3 !== crosswalkRop3) {
    setValue(input.row, input.outputKeys, "PG_ROP3", "");
    input.findings.push(
      finding(
        "error",
        "source-crosswalk-rop3-conflict",
        input.rowIndex,
        input.stableRowKey,
        "PG_ROP3",
        sourceRop3,
        crosswalkRop3,
        "Source ROP3 conflicts with the unambiguous tracking crosswalk; neither value was selected.",
      ),
    );
    return false;
  }

  const rop3 = sourceRop3 || crosswalkRop3;
  const match = rop3 ? input.ropIndex.byRop3.get(rop3) ?? null : null;
  if (!match) {
    setValue(input.row, input.outputKeys, "PG_ROP3", "");
    input.findings.push(
      finding(
        "error",
        "missing-resolved-rop3",
        input.rowIndex,
        input.stableRowKey,
        "PG_ROP3",
        sourceRop3 || crosswalkRop3,
        null,
        "The row has no exact ROP3 after applying its typed tracking contract.",
      ),
    );
    return false;
  }

  setValue(input.row, input.outputKeys, "PG_ROP1", match.rop1Code ?? "");
  setValue(input.row, input.outputKeys, "PG_ROP2", match.rop2Code ?? "");
  setValue(input.row, input.outputKeys, "PG_ROP25", match.rop25Code ?? "");
  setValue(input.row, input.outputKeys, "PG_ROP3", rop3);
  return true;
}

function applyCountry(input: {
  forming: Tier2FormingInput;
  sourceRow: Readonly<Record<string, string>>;
  sourceColumns: ReturnType<typeof createSourceColumnIndex>;
  row: Record<string, string>;
  outputKeys: ReadonlyMap<string, string>;
  rowIndex: number;
  stableRowKey: string;
  crosswalkIso3: string;
  countryIndex: ReturnType<typeof createCountryReferenceIndex>;
  findings: DatasetFormingFinding[];
}) {
  const sourceCountry = input.forming.profile.sourceCountryColumn
    ? input.sourceColumns.value(
        input.sourceRow,
        input.forming.profile.sourceCountryColumn,
      )
    : getValue(input.row, input.outputKeys, "Geo_Country_Name");
  const sourceIso3 = normalizeIdentifier(
    input.forming.profile.sourceIso3Column
      ? input.sourceColumns.value(
          input.sourceRow,
          input.forming.profile.sourceIso3Column,
        )
      : getValue(input.row, input.outputKeys, "Geo_ISO3"),
  ).toUpperCase();
  const crosswalkIso3 = input.crosswalkIso3.toUpperCase();
  setValue(
    input.row,
    input.outputKeys,
    "Crosswalk_Geo_ISO3_Evidence",
    crosswalkIso3,
  );
  if (sourceIso3 && crosswalkIso3 && sourceIso3 !== crosswalkIso3) {
    input.findings.push(
      finding(
        "error",
        "source-crosswalk-country-conflict",
        input.rowIndex,
        input.stableRowKey,
        "Geo_ISO3",
        sourceIso3,
        crosswalkIso3,
        "Source ISO3 conflicts with the pinned tracking crosswalk.",
      ),
    );
    return false;
  }
  const resolution = resolveCountryReference({
    sourceIso3: sourceIso3 || crosswalkIso3,
    sourceCountryName: sourceCountry,
    policy: {
      countryOutputField: "Geo_Country_Name",
      iso3OutputField: "Geo_ISO3",
      aliasNormalization: "nfkc",
      allowMultiCountryText: false,
    },
    index: input.countryIndex,
  });
  setValue(input.row, input.outputKeys, "Geo_ISO3", resolution.iso3);
  setValue(
    input.row,
    input.outputKeys,
    "Geo_Country_Name",
    resolution.countryName,
  );
  if (resolution.status === "resolved") return true;
  input.findings.push(
    finding(
      "error",
      `country-${resolution.status}`,
      input.rowIndex,
      input.stableRowKey,
      "Geo_ISO3",
      `${sourceIso3} / ${sourceCountry}`.trim(),
      null,
      "Country evidence does not resolve to one exact pinned country.",
    ),
  );
  return false;
}

export function formTier2PartnerRows(
  input: Tier2FormingInput,
): Tier2FormingResult {
  const profileValidation = validateTier2PartnerProfileConfig(input.profile);
  if (!profileValidation.valid) {
    throw new Error(
      `Invalid Tier 2 profile: ${profileValidation.issues.map((entry) => entry.message).join(" ")}`,
    );
  }
  const resourceIssues = validateTier2PartnerResources(input.resources);
  if (resourceIssues.length > 0) {
    throw new Error(
      `Invalid Tier 2 resource bindings: ${resourceIssues.map((entry) => entry.message).join(" ")}`,
    );
  }
  resolveTier2PartnerSourceAlias({
    partnerKey: input.profile.partnerKey,
    resources: input.resources,
  });

  const columns = normalizeHeaders(outputLabels(input));
  const outputKeys = new Map(columns.map((column) => [column.label, column.key]));
  const sourceColumns = createSourceColumnIndex(input.columns);
  const countryIndex = createCountryReferenceIndex(input.resources.countries);
  const ropIndex = createRopReferenceIndex(input.resources.ropEntries);
  const peopleId3 = createActiveIndex(
    input.resources.peopleId3Entries,
    (entry) => entry.active,
    (entry) => entry.peopleId3,
  );
  const peids = createActiveIndex(
    input.resources.peidEntries,
    (entry) => entry.active,
    (entry) => entry.peid,
  );
  const findings: DatasetFormingFinding[] = [];
  const rows: Record<string, string>[] = [];
  const stableKeys: string[] = [];
  let missingStableKeyRows = 0;
  let unresolvedTrackingRows = 0;
  let ambiguousTrackingRows = 0;
  let invalidSourceRop3Rows = 0;
  let conflictingSourceRop3Rows = 0;
  let unresolvedCountryRows = 0;
  let invalidValueCount = 0;

  input.rows.forEach((sourceRow, rowIndex) => {
    const row = Object.fromEntries(columns.map((column) => [column.key, ""]));
    const stableRowId = normalizeIdentifier(
      sourceColumns.value(sourceRow, input.profile.stableRowKeyColumn),
    );
    const stableRowKey = createStableSourceRowKey({
      sourceProfileKey: input.profile.profileKey,
      selector: `sheet-${input.profile.sheetId}`,
      sourceIdentifier: stableRowId,
    });
    stableKeys.push(stableRowKey);
    if (!stableRowKey) {
      missingStableKeyRows += 1;
      findings.push(
        finding(
          "error",
          "missing-stable-row-key",
          rowIndex,
          null,
          input.profile.stableRowKeyColumn,
          stableRowId,
          null,
          "A durable source row key is required; positional identity is not allowed.",
        ),
      );
    }

    for (const mapping of input.resources.engagementMappings.filter(
      (entry) => entry.active,
    )) {
      const rawValue = sourceColumns.value(sourceRow, mapping.sourceField);
      const converted = convertSourceValue(toSourceType(mapping.dataType), rawValue);
      setValue(row, outputKeys, mapping.canonicalField, converted.value);
      if (!converted.valid) {
        invalidValueCount += 1;
        findings.push(
          finding(
            "error",
            "invalid-mapped-value",
            rowIndex,
            stableRowKey || null,
            mapping.canonicalField,
            rawValue,
            null,
            `${mapping.sourceField} is not a valid ${mapping.dataType}.`,
          ),
        );
      }
    }

    setValue(row, outputKeys, "Data_Source", input.profile.partnerKey);
    setValue(
      row,
      outputKeys,
      "Dataset_ID",
      `${input.profile.spreadsheetId}:${input.profile.sheetId}:${input.sourceRunId}`,
    );
    setValue(row, outputKeys, "Dataset_Row_ID", stableRowId);
    setValue(row, outputKeys, "Dataset_Row_Key", stableRowKey);
    setValue(row, outputKeys, "Tier2_Profile_Key", input.profile.profileKey);
    setValue(row, outputKeys, "Tier2_Partner_Key", input.profile.partnerKey);

    const tracking = resolveTracking({
      forming: input,
      sourceRow,
      sourceColumns,
      row,
      outputKeys,
      rowIndex,
      stableRowKey,
      peopleId3,
      peids,
      findings,
    });
    if (!tracking.trackingId || (!tracking.rop3 && input.profile.trackingIdSource !== "provider-native")) {
      unresolvedTrackingRows += 1;
    }
    if (tracking.ambiguous) ambiguousTrackingRows += 1;

    const ropResolved = applyRop({
      forming: input,
      sourceRow,
      sourceColumns,
      row,
      outputKeys,
      rowIndex,
      stableRowKey,
      crosswalkRop3: tracking.rop3,
      ropIndex,
      findings,
    });
    const rowFindings = findings.filter((entry) => entry.sourceRowIndex === rowIndex);
    if (rowFindings.some((entry) => entry.ruleCode === "invalid-source-rop3")) {
      invalidSourceRop3Rows += 1;
    }
    if (
      rowFindings.some(
        (entry) => entry.ruleCode === "source-crosswalk-rop3-conflict",
      )
    ) {
      conflictingSourceRop3Rows += 1;
    }
    if (!ropResolved && input.profile.trackingIdSource === "provider-native") {
      unresolvedTrackingRows += 1;
    }

    if (
      !applyCountry({
        forming: input,
        sourceRow,
        sourceColumns,
        row,
        outputKeys,
        rowIndex,
        stableRowKey,
        crosswalkIso3: tracking.iso3,
        countryIndex,
        findings,
      })
    ) {
      unresolvedCountryRows += 1;
    }
    rows.push(row);
  });

  const duplicateGroups = groupDuplicateIndexes(stableKeys);
  for (const [stableRowKey, indexes] of duplicateGroups) {
    for (const rowIndex of indexes) {
      findings.push(
        finding(
          "error",
          "duplicate-stable-row-key",
          rowIndex,
          stableRowKey,
          "Dataset_Row_Key",
          stableRowKey,
          null,
          "The durable source row key is duplicated within this snapshot.",
          { duplicateIndexes: indexes },
        ),
      );
    }
  }

  const warningCount = findings.filter(
    (entry) => entry.severity === "warning",
  ).length;
  const errorCount = findings.filter((entry) => entry.severity === "error").length;
  const validation: Tier2FormingValidation = {
    warningCount,
    errorCount,
    inputRowCount: input.rows.length,
    outputRowCount: rows.length,
    missingStableKeyRows,
    duplicateStableKeyRows: [...duplicateGroups.values()].reduce(
      (total, indexes) => total + indexes.length,
      0,
    ),
    unresolvedTrackingRows,
    ambiguousTrackingRows,
    invalidSourceRop3Rows,
    conflictingSourceRop3Rows,
    unresolvedCountryRows,
    invalidValueCount,
  };

  return {
    columns,
    rows,
    findings,
    validation,
    outputChecksum: checksumSourceFormingValue({ columns, rows }),
    valid: errorCount === 0,
    resourceLineage: input.resources.lineage,
  };
}

function rowValueByLabel(
  columns: readonly { key: string; label: string }[],
  row: Readonly<Record<string, string>>,
  label: string,
) {
  const key = columns.find((column) => column.label === label)?.key;
  return key ? row[key] || null : null;
}

export function extractTier2IdentityEvidence(
  input: Tier2FormingInput,
  result: Tier2FormingResult,
): Tier2IdentityEvidence[] {
  return result.rows.map((row) => ({
    sourceProfileKey: input.profile.profileKey,
    stableRowKey:
      rowValueByLabel(result.columns, row, "Dataset_Row_Key") ?? "",
    trackingIdSource: input.profile.trackingIdSource,
    trackingId:
      rowValueByLabel(result.columns, row, "Tier2_Tracking_ID") ?? "",
    peopleId3: rowValueByLabel(result.columns, row, "PG_PeopleID3"),
    peid: rowValueByLabel(result.columns, row, "PG_PEID"),
    rop3: rowValueByLabel(result.columns, row, "PG_ROP3"),
    iso3: rowValueByLabel(result.columns, row, "Geo_ISO3"),
    providerNativeId: rowValueByLabel(
      result.columns,
      row,
      "Provider_Native_Identity",
    ),
  }));
}
