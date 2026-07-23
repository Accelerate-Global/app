import type { CsvColumn } from "@/lib/api-types";
import { normalizeHeaders } from "@/lib/csv";
import type { DatasetFormingFinding } from "@/lib/dataset-forming/types";

import { checksumSourceFormingValue } from "./canonical";
import {
  getSourceFieldContractChecksum,
  getSourceTransformationChecksum,
} from "./contracts";
import {
  convertSourceValue,
  createCountryReferenceIndex,
  createFinding,
  createRopReferenceIndex,
  createSourceColumnIndex,
  createStableSourceRowKey,
  extractSingleScalarIdentifier,
  groupDuplicateIndexes,
  normalizeExactLookup,
  normalizeIdentifier,
  resolveCountryReference,
} from "./primitives";
import type {
  FormSourceRowsInput,
  FormedRowState,
  SourceFormingContract,
  SourceFormingResult,
} from "./types";

function outputColumnsFor(contract: SourceFormingContract) {
  const labels = contract.fields.map((field) => field.outputField);
  if (new Set(labels).size !== labels.length) {
    throw new Error(`Source contract ${contract.key} repeats an output field.`);
  }
  return normalizeHeaders(labels);
}

function outputKeyIndex(columns: readonly CsvColumn[]) {
  return new Map(columns.map((column) => [column.label, column.key]));
}

function setOutput(
  row: Record<string, string>,
  outputKeys: ReadonlyMap<string, string>,
  field: string,
  value: string,
) {
  const key = outputKeys.get(field);
  if (key) row[key] = value;
}

function getOutput(
  row: Readonly<Record<string, string>>,
  outputKeys: ReadonlyMap<string, string>,
  field: string,
) {
  const key = outputKeys.get(field);
  return key ? row[key] ?? "" : "";
}

function appendFinding(
  target: DatasetFormingFinding[],
  input: Parameters<typeof createFinding>[0],
) {
  target.push(createFinding(input));
}

function isKnownSourceField(input: {
  label: string;
  contract: SourceFormingContract;
  configuredStableKeyColumn: string | null;
}) {
  const normalized = normalizeExactLookup(input.label);
  if (
    input.contract.fields.some(
      (field) =>
        field.sourceField && normalizeExactLookup(field.sourceField) === normalized,
    ) ||
    input.contract.knownExcludedSourceFields.some(
      (field) => normalizeExactLookup(field) === normalized,
    ) ||
    (input.configuredStableKeyColumn &&
      normalizeExactLookup(input.configuredStableKeyColumn) === normalized)
  ) {
    return true;
  }

  const stable = input.contract.stableIdentity;
  if (
    stable.kind === "etnopedia" &&
    [...stable.pageIdFields, stable.titleField].some(
      (field) => normalizeExactLookup(field) === normalized,
    )
  ) {
    return true;
  }
  if (
    stable.kind === "joshua-project" &&
    [
      ...stable.providerIdFields,
      stable.peopleId3Field,
      stable.iso3Field,
    ].some((field) => normalizeExactLookup(field) === normalized)
  ) {
    return true;
  }
  return input.contract.knownSourceFieldPatterns.some((pattern) =>
    new RegExp(pattern, "u").test(input.label),
  );
}

function jpCrosswalkFor(input: FormSourceRowsInput, findings: DatasetFormingFinding[]) {
  const byPeopleId3 = new Map<string, NonNullable<typeof input.resources.jpPeopleId3Entries>[number]>();
  const conflicts = new Set<string>();
  for (const entry of input.resources.jpPeopleId3Entries ?? []) {
    if (!entry.active) continue;
    const key = normalizeIdentifier(entry.peopleId3);
    const prior = byPeopleId3.get(key);
    if (prior && JSON.stringify(prior) !== JSON.stringify(entry)) conflicts.add(key);
    else if (!prior) byPeopleId3.set(key, entry);
  }
  for (const key of [...conflicts].sort()) {
    appendFinding(findings, {
      severity: "error",
      ruleCode: "ambiguous-jp-peopleid3-reference",
      sourceRowIndex: null,
      stableRowKey: null,
      fieldName: "PG_PeopleID3",
      sourceValue: key,
      canonicalValue: null,
      message: `Pinned Joshua Project PeopleID3 resource repeats ${key} with conflicting values.`,
    });
  }
  return { byPeopleId3, conflicts };
}

function applyEtnopediaPeid(input: {
  row: Record<string, string>;
  outputKeys: ReadonlyMap<string, string>;
  findings: DatasetFormingFinding[];
  sourceRowIndex: number;
}) {
  const evidence = getOutput(input.row, input.outputKeys, "Source_PEID_Evidence");
  const scalar = extractSingleScalarIdentifier(evidence);
  setOutput(input.row, input.outputKeys, "PG_PEID", scalar.value);
  if (evidence && !scalar.scalar) {
    appendFinding(input.findings, {
      severity: "warning",
      ruleCode: "non-scalar-peid-evidence",
      sourceRowIndex: input.sourceRowIndex,
      stableRowKey: null,
      fieldName: "PG_PEID",
      sourceValue: evidence,
      canonicalValue: "",
      message: "Etnopedia PEID evidence is not one scalar identifier; it remains source evidence only.",
    });
  }
}

function applyJpCrosswalk(input: {
  row: Record<string, string>;
  outputKeys: ReadonlyMap<string, string>;
  findings: DatasetFormingFinding[];
  sourceRowIndex: number;
  crosswalk: ReturnType<typeof jpCrosswalkFor>;
}) {
  const peopleId3 = getOutput(input.row, input.outputKeys, "PG_PeopleID3");
  const reference = input.crosswalk.byPeopleId3.get(peopleId3);
  if (!peopleId3 || !reference || input.crosswalk.conflicts.has(peopleId3)) return;

  const iso3 = getOutput(input.row, input.outputKeys, "Geo_ISO3").toUpperCase();
  if (!iso3 && reference.iso3) {
    setOutput(input.row, input.outputKeys, "Geo_ISO3", reference.iso3.toUpperCase());
  } else if (iso3 && reference.iso3 && iso3 !== reference.iso3.toUpperCase()) {
    appendFinding(input.findings, {
      severity: "warning",
      ruleCode: "jp-peopleid3-iso3-conflict",
      sourceRowIndex: input.sourceRowIndex,
      stableRowKey: null,
      fieldName: "Geo_ISO3",
      sourceValue: iso3,
      canonicalValue: reference.iso3.toUpperCase(),
      message: "Joshua Project source ISO3 conflicts with its pinned PeopleID3 crosswalk.",
    });
  }

  const rop3 = getOutput(input.row, input.outputKeys, "PG_ROP3");
  if (!rop3 && reference.rop3) {
    setOutput(input.row, input.outputKeys, "PG_ROP3", reference.rop3);
  } else if (rop3 && reference.rop3 && rop3 !== reference.rop3) {
    appendFinding(input.findings, {
      severity: "warning",
      ruleCode: "jp-peopleid3-rop3-conflict",
      sourceRowIndex: input.sourceRowIndex,
      stableRowKey: null,
      fieldName: "PG_ROP3",
      sourceValue: rop3,
      canonicalValue: reference.rop3,
      message: "Joshua Project source ROP3 conflicts with its pinned PeopleID3 crosswalk.",
    });
  } else if (!rop3 && reference.parentStatus === "approved-missing") {
    appendFinding(input.findings, {
      severity: "warning",
      ruleCode: "approved-missing-rop-parent",
      sourceRowIndex: input.sourceRowIndex,
      stableRowKey: null,
      fieldName: "PG_ROP3",
      sourceValue: peopleId3,
      canonicalValue: null,
      message: "This PeopleID3 has a reviewed missing ROP3 parent.",
      details: { reason: reference.missingParentReason },
    });
  }
}

function applyCountry(input: {
  contract: SourceFormingContract;
  row: Record<string, string>;
  outputKeys: ReadonlyMap<string, string>;
  findings: DatasetFormingFinding[];
  sourceRowIndex: number;
  countryIndex: ReturnType<typeof createCountryReferenceIndex>;
}) {
  const iso3Field = input.contract.country.iso3OutputField;
  const countryField = input.contract.country.countryOutputField;
  const sourceIso3 = getOutput(input.row, input.outputKeys, iso3Field);
  const sourceCountryName = getOutput(input.row, input.outputKeys, countryField);
  const resolution = resolveCountryReference({
    sourceIso3,
    sourceCountryName,
    policy: input.contract.country,
    index: input.countryIndex,
  });
  setOutput(input.row, input.outputKeys, iso3Field, resolution.iso3);
  setOutput(input.row, input.outputKeys, countryField, resolution.countryName);

  if (resolution.status === "resolved") return true;
  if (resolution.status === "conflict") {
    appendFinding(input.findings, {
      severity: "warning",
      ruleCode: "country-iso-conflict",
      sourceRowIndex: input.sourceRowIndex,
      stableRowKey: null,
      fieldName: iso3Field,
      sourceValue: `${sourceIso3} / ${sourceCountryName}`,
      canonicalValue: `${resolution.iso3} / ${resolution.countryName}`,
      message: "Source country text conflicts with a valid ISO3; the exact ISO3 match was retained.",
      details: { countryTextIso3: resolution.conflictingCountry?.iso3 ?? null },
    });
    return true;
  }
  appendFinding(input.findings, {
    severity: resolution.status === "ambiguous" ? "error" : "warning",
    ruleCode:
      resolution.status === "ambiguous"
        ? "ambiguous-country-alias"
        : resolution.status === "multi"
          ? "multi-country-source-value"
          : "unresolved-country",
    sourceRowIndex: input.sourceRowIndex,
    stableRowKey: null,
    fieldName: iso3Field,
    sourceValue: `${sourceIso3} / ${sourceCountryName}`.trim(),
    canonicalValue: null,
    message:
      resolution.status === "ambiguous"
        ? "Country alias matches more than one pinned country."
        : resolution.status === "multi"
          ? "Source row names multiple countries; the row and source text were preserved without choosing one."
          : "Country and ISO3 did not resolve through an exact pinned match.",
  });
  return false;
}

function applyRop(input: {
  contract: SourceFormingContract;
  row: Record<string, string>;
  outputKeys: ReadonlyMap<string, string>;
  findings: DatasetFormingFinding[];
  sourceRowIndex: number;
  ropIndex: ReturnType<typeof createRopReferenceIndex>;
}) {
  const policy = input.contract.rop;
  const sourceRop3 = normalizeIdentifier(
    getOutput(input.row, input.outputKeys, policy.rop3OutputField),
  );
  const sourceParents = {
    rop1: getOutput(input.row, input.outputKeys, policy.rop1OutputField),
    rop2: getOutput(input.row, input.outputKeys, policy.rop2OutputField),
    rop25: getOutput(input.row, input.outputKeys, policy.rop25OutputField),
  };
  const match = input.ropIndex.byRop3.get(sourceRop3);
  if (sourceRop3 && match && !input.ropIndex.conflictingRop3.has(sourceRop3)) {
    const canonicalParents = {
      rop1: match.rop1Code ?? "",
      rop2: match.rop2Code ?? "",
      rop25: match.rop25Code ?? "",
    };
    setOutput(input.row, input.outputKeys, policy.rop3OutputField, sourceRop3);
    setOutput(input.row, input.outputKeys, policy.rop1OutputField, canonicalParents.rop1);
    setOutput(input.row, input.outputKeys, policy.rop2OutputField, canonicalParents.rop2);
    setOutput(input.row, input.outputKeys, policy.rop25OutputField, canonicalParents.rop25);
    if (
      (sourceParents.rop1 && sourceParents.rop1 !== canonicalParents.rop1) ||
      (sourceParents.rop2 && sourceParents.rop2 !== canonicalParents.rop2) ||
      (sourceParents.rop25 && sourceParents.rop25 !== canonicalParents.rop25)
    ) {
      appendFinding(input.findings, {
        severity: "warning",
        ruleCode: "rop-parent-conflict",
        sourceRowIndex: input.sourceRowIndex,
        stableRowKey: null,
        fieldName: policy.rop3OutputField,
        sourceValue: sourceRop3,
        canonicalValue: sourceRop3,
        message: "Source ROP parents differ from the exact pinned ROP3 hierarchy.",
        details: { sourceParents, canonicalParents },
      });
    }
    if (match.status === "Inactive" || match.joinIssue) {
      appendFinding(input.findings, {
        severity: "warning",
        ruleCode: match.status === "Inactive" ? "inactive-rop3" : "rop-resource-join-issue",
        sourceRowIndex: input.sourceRowIndex,
        stableRowKey: null,
        fieldName: policy.rop3OutputField,
        sourceValue: sourceRop3,
        canonicalValue: sourceRop3,
        message:
          match.status === "Inactive"
            ? "ROP3 resolves to an inactive pinned resource entry."
            : match.joinIssueLabel ?? "ROP3 resolves with a pinned resource join warning.",
        details: { joinIssue: match.joinIssue },
      });
    }
    return true;
  }

  setOutput(input.row, input.outputKeys, policy.rop3OutputField, sourceRop3);
  setOutput(input.row, input.outputKeys, policy.rop1OutputField, "");
  setOutput(input.row, input.outputKeys, policy.rop2OutputField, "");
  setOutput(input.row, input.outputKeys, policy.rop25OutputField, "");
  appendFinding(input.findings, {
    severity: "warning",
    ruleCode: input.ropIndex.conflictingRop3.has(sourceRop3)
      ? "ambiguous-rop3-reference"
      : "unresolved-rop3",
    sourceRowIndex: input.sourceRowIndex,
    stableRowKey: null,
    fieldName: policy.rop3OutputField,
    sourceValue: sourceRop3,
    canonicalValue: null,
    message: sourceRop3
      ? "ROP3 did not resolve through one exact pinned hierarchy row."
      : "ROP3 is blank and remains unresolved.",
    details: { sourceParents },
  });
  return false;
}

function resolveStableIdentity(input: {
  contract: SourceFormingContract;
  sourceProfileKey: string;
  sourceRow: Record<string, string>;
  formedRow: Record<string, string>;
  columns: ReturnType<typeof createSourceColumnIndex>;
  outputKeys: ReadonlyMap<string, string>;
  configuredStableKeyColumn: string | null;
}) {
  const policy = input.contract.stableIdentity;
  if (policy.kind === "etnopedia") {
    for (const field of policy.pageIdFields) {
      const id = normalizeIdentifier(input.columns.value(input.sourceRow, field));
      if (id) {
        return {
          stableRowId: id,
          stableRowKey: createStableSourceRowKey({
            sourceProfileKey: input.sourceProfileKey,
            selector: "pageid",
            sourceIdentifier: id,
          }),
        };
      }
    }
    const title = normalizeIdentifier(
      input.columns.value(input.sourceRow, policy.titleField),
    );
    return {
      stableRowId: title,
      stableRowKey: createStableSourceRowKey({
        sourceProfileKey: input.sourceProfileKey,
        selector: "title",
        sourceIdentifier: title,
      }),
    };
  }

  if (policy.kind === "joshua-project") {
    for (const field of policy.providerIdFields) {
      const id = normalizeIdentifier(input.columns.value(input.sourceRow, field));
      if (id) {
        return {
          stableRowId: id,
          stableRowKey: createStableSourceRowKey({
            sourceProfileKey: input.sourceProfileKey,
            selector: "provider-id",
            sourceIdentifier: id,
          }),
        };
      }
    }
    const peopleId3 = getOutput(input.formedRow, input.outputKeys, "PG_PeopleID3");
    const iso3 = getOutput(input.formedRow, input.outputKeys, "Geo_ISO3");
    const composite = peopleId3 && iso3 ? `${peopleId3}:${iso3}` : "";
    return {
      stableRowId: composite,
      stableRowKey: createStableSourceRowKey({
        sourceProfileKey: input.sourceProfileKey,
        selector: "peopleid3-iso3",
        sourceIdentifier: composite,
      }),
    };
  }

  const id = input.configuredStableKeyColumn
    ? normalizeIdentifier(
        input.columns.value(input.sourceRow, input.configuredStableKeyColumn),
      )
    : "";
  return {
    stableRowId: id,
    stableRowKey: createStableSourceRowKey({
      sourceProfileKey: input.sourceProfileKey,
      selector: "source-key",
      sourceIdentifier: id,
    }),
  };
}

function addDuplicateFindings(input: {
  states: FormedRowState[];
  findings: DatasetFormingFinding[];
  outputKeys: ReadonlyMap<string, string>;
}) {
  const stableGroups = groupDuplicateIndexes(
    input.states.map((state) => state.stableRowKey),
  );
  for (const [stableRowKey, indexes] of stableGroups) {
    for (const index of indexes) {
      const state = input.states[index]!;
      appendFinding(input.findings, {
        severity: "error",
        ruleCode: "duplicate-stable-row-key",
        sourceRowIndex: state.sourceRowIndex,
        stableRowKey,
        fieldName: "Dataset_Row_Key",
        sourceValue: state.stableRowId,
        canonicalValue: stableRowKey,
        message: "Stable source identity appears more than once in this candidate.",
        details: { duplicateSourceRowIndexes: indexes },
      });
    }
  }

  const domainValues = input.states.map((state) => {
    if (!state.countryResolved || !state.ropResolved) return "";
    const rop3 = getOutput(state.row, input.outputKeys, "PG_ROP3");
    const iso3 = getOutput(state.row, input.outputKeys, "Geo_ISO3");
    return rop3 && iso3 ? `${rop3}||${iso3}` : "";
  });
  const domainGroups = groupDuplicateIndexes(domainValues);
  for (const [domainKey, indexes] of domainGroups) {
    for (const index of indexes) {
      const state = input.states[index]!;
      appendFinding(input.findings, {
        severity: "error",
        ruleCode: "duplicate-complete-domain-key",
        sourceRowIndex: state.sourceRowIndex,
        stableRowKey: state.stableRowKey || null,
        fieldName: "PG_ROP3",
        sourceValue: domainKey,
        canonicalValue: domainKey,
        message: "Canonical ROP3 and ISO3 duplicate another complete person-country row.",
        details: { duplicateSourceRowIndexes: indexes },
      });
    }
  }
}

export function formSourceRows(
  contract: SourceFormingContract,
  input: FormSourceRowsInput,
): SourceFormingResult {
  const findings: DatasetFormingFinding[] = [];
  const sourceColumns = createSourceColumnIndex(input.columns);
  const outputColumns = outputColumnsFor(contract);
  const outputKeys = outputKeyIndex(outputColumns);
  const configuredStableKeyColumn = normalizeIdentifier(
    input.resources.stableKeyColumn ?? "",
  ) || null;

  for (const field of contract.fields) {
    if (
      field.sourceField &&
      field.requiredSourceColumn &&
      !sourceColumns.get(field.sourceField)
    ) {
      appendFinding(findings, {
        severity: "error",
        ruleCode: "missing-required-source-field",
        sourceRowIndex: null,
        stableRowKey: null,
        fieldName: field.sourceField,
        sourceValue: null,
        canonicalValue: field.outputField,
        message: `Required source field ${field.sourceField} is missing for ${contract.key}.`,
      });
    }
  }

  if (contract.stableIdentity.kind === "configured-column") {
    if (!configuredStableKeyColumn) {
      appendFinding(findings, {
        severity: "error",
        ruleCode: "missing-stable-key-configuration",
        sourceRowIndex: null,
        stableRowKey: null,
        fieldName: null,
        sourceValue: null,
        canonicalValue: null,
        message: `${contract.key} requires an administrator-configured stable source key column.`,
      });
    } else if (!sourceColumns.get(configuredStableKeyColumn)) {
      appendFinding(findings, {
        severity: "error",
        ruleCode: "missing-stable-key-column",
        sourceRowIndex: null,
        stableRowKey: null,
        fieldName: configuredStableKeyColumn,
        sourceValue: null,
        canonicalValue: null,
        message: `Configured stable key column ${configuredStableKeyColumn} is absent from the source snapshot.`,
      });
    }
  }

  const schemaDriftFields = input.columns
    .map((column) => column.label)
    .filter(
      (label) =>
        !isKnownSourceField({
          label,
          contract,
          configuredStableKeyColumn,
        }),
    )
    .sort((left, right) => left.localeCompare(right));
  for (const field of schemaDriftFields) {
    appendFinding(findings, {
      severity: "warning",
      ruleCode: "source-schema-drift",
      sourceRowIndex: null,
      stableRowKey: null,
      fieldName: field,
      sourceValue: null,
      canonicalValue: null,
      message: `Source supplied uncontracted field ${field}; it remains in the raw artifact only.`,
    });
  }

  const countryIndex = createCountryReferenceIndex(input.resources.countries);
  const ropIndex = createRopReferenceIndex(input.resources.ropEntries);
  for (const alias of [...countryIndex.ambiguousExactAliases].sort()) {
    appendFinding(findings, {
      severity: "error",
      ruleCode: "ambiguous-country-reference",
      sourceRowIndex: null,
      stableRowKey: null,
      fieldName: "Geo_Country_Name",
      sourceValue: alias,
      canonicalValue: null,
      message: `Pinned country resource has conflicting exact alias ${alias}.`,
    });
  }
  for (const rop3 of [...ropIndex.conflictingRop3].sort()) {
    appendFinding(findings, {
      severity: "error",
      ruleCode: "ambiguous-rop-reference",
      sourceRowIndex: null,
      stableRowKey: null,
      fieldName: "PG_ROP3",
      sourceValue: rop3,
      canonicalValue: null,
      message: `Pinned ROP resource has conflicting hierarchy rows for ${rop3}.`,
    });
  }
  const jpCrosswalk = jpCrosswalkFor(input, findings);

  const states: FormedRowState[] = input.rows.map((sourceRow, sourceRowIndex) => {
    const row = Object.fromEntries(outputColumns.map((column) => [column.key, ""]));
    const rowFindings: DatasetFormingFinding[] = [];
    for (const field of contract.fields) {
      if (!field.sourceField) continue;
      const rawValue = sourceColumns.value(sourceRow, field.sourceField);
      const converted = convertSourceValue(field.type, rawValue);
      setOutput(row, outputKeys, field.outputField, converted.value);
      if (!converted.valid) {
        appendFinding(rowFindings, {
          severity: "error",
          ruleCode: "invalid-source-value",
          sourceRowIndex,
          stableRowKey: null,
          fieldName: field.outputField,
          sourceValue: rawValue,
          canonicalValue: "",
          message: `${field.outputField} could not be converted to ${field.type}.`,
          details: { semanticType: field.type },
        });
      } else if (field.requiredMappedValue && !converted.value) {
        appendFinding(rowFindings, {
          severity: "error",
          ruleCode: "missing-required-mapped-value",
          sourceRowIndex,
          stableRowKey: null,
          fieldName: field.outputField,
          sourceValue: rawValue,
          canonicalValue: "",
          message: `${field.outputField} is required after source mapping.`,
          details: { sourceField: field.sourceField },
        });
      }
    }

    if (contract.profileKind === "etnopedia") {
      applyEtnopediaPeid({ row, outputKeys, findings: rowFindings, sourceRowIndex });
    } else if (contract.profileKind === "joshua-project") {
      applyJpCrosswalk({
        row,
        outputKeys,
        findings: rowFindings,
        sourceRowIndex,
        crosswalk: jpCrosswalk,
      });
    }

    const countryResolved = applyCountry({
      contract,
      row,
      outputKeys,
      findings: rowFindings,
      sourceRowIndex,
      countryIndex,
    });
    const ropResolved = applyRop({
      contract,
      row,
      outputKeys,
      findings: rowFindings,
      sourceRowIndex,
      ropIndex,
    });
    const identity = resolveStableIdentity({
      contract,
      sourceProfileKey: input.sourceProfileKey,
      sourceRow,
      formedRow: row,
      columns: sourceColumns,
      outputKeys,
      configuredStableKeyColumn,
    });
    setOutput(row, outputKeys, "Data_Source", contract.dataSourceCode);
    setOutput(row, outputKeys, "Dataset_ID", input.sourceRunId);
    setOutput(row, outputKeys, "Dataset_Row_ID", identity.stableRowId);
    setOutput(row, outputKeys, "Dataset_Row_Key", identity.stableRowKey);
    const hydratedFindings = rowFindings.map((finding) => ({
      ...finding,
      stableRowKey: identity.stableRowKey || null,
    }));
    findings.push(...hydratedFindings);
    if (!identity.stableRowKey) {
      appendFinding(findings, {
        severity: "error",
        ruleCode: "missing-stable-source-identity",
        sourceRowIndex,
        stableRowKey: null,
        fieldName:
          contract.stableIdentity.kind === "configured-column"
            ? configuredStableKeyColumn
            : "Dataset_Row_Key",
        sourceValue: identity.stableRowId,
        canonicalValue: null,
        message: "Row has no durable source identity; row ordinal fallback is prohibited.",
      });
    }
    return {
      sourceRowIndex,
      sourceRow,
      row,
      stableRowId: identity.stableRowId,
      stableRowKey: identity.stableRowKey,
      countryResolved,
      ropResolved,
      findings: hydratedFindings,
    };
  });

  addDuplicateFindings({ states, findings, outputKeys });
  const rows = states.map((state) => state.row);
  if (rows.length !== input.rows.length) {
    appendFinding(findings, {
      severity: "error",
      ruleCode: "row-count-divergence",
      sourceRowIndex: null,
      stableRowKey: null,
      fieldName: null,
      sourceValue: String(input.rows.length),
      canonicalValue: String(rows.length),
      message: "Formed row count does not match the readable source row count.",
    });
  }

  const validation = {
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    errorCount: findings.filter((finding) => finding.severity === "error").length,
    inputRowCount: input.rows.length,
    outputRowCount: rows.length,
    missingStableKeyRows: findings.filter(
      (finding) => finding.ruleCode === "missing-stable-source-identity",
    ).length,
    duplicateStableKeyRows: findings.filter(
      (finding) => finding.ruleCode === "duplicate-stable-row-key",
    ).length,
    duplicateDomainKeyRows: findings.filter(
      (finding) => finding.ruleCode === "duplicate-complete-domain-key",
    ).length,
    unresolvedCountryRows: findings.filter(
      (finding) =>
        finding.ruleCode === "unresolved-country" ||
        finding.ruleCode === "multi-country-source-value",
    ).length,
    ambiguousCountryRows: findings.filter(
      (finding) => finding.ruleCode === "ambiguous-country-alias",
    ).length,
    countryConflictRows: findings.filter(
      (finding) => finding.ruleCode === "country-iso-conflict",
    ).length,
    unresolvedRopRows: findings.filter(
      (finding) => finding.ruleCode === "unresolved-rop3",
    ).length,
    ropParentConflictRows: findings.filter(
      (finding) => finding.ruleCode === "rop-parent-conflict",
    ).length,
    invalidValueCount: findings.filter(
      (finding) => finding.ruleCode === "invalid-source-value",
    ).length,
    schemaDriftFields,
  };

  return {
    contractKey: contract.key,
    contractVersion: contract.version,
    fieldContractChecksum: getSourceFieldContractChecksum(contract),
    transformationChecksum: getSourceTransformationChecksum(contract),
    columns: outputColumns,
    rows,
    findings,
    validation,
    outputChecksum: checksumSourceFormingValue({ columns: outputColumns, rows }),
    valid: validation.errorCount === 0,
  };
}
