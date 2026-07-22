import { createHash } from "node:crypto";

import type { CsvColumn } from "@/lib/api-types";
import { normalizeHeaders } from "@/lib/csv";

import {
  IMB_DATA_SOURCE_CODE,
  IMB_FIELD_CONTRACT,
  IMB_FIELD_CONTRACT_VERSION,
  IMB_FORMING_TRANSFORMATION_VERSION,
  IMB_KNOWN_EXCLUDED_SOURCE_FIELDS,
  type ImbFieldContractEntry,
} from "./field-contract";
import type {
  ImbFormingFinding,
  ImbFormingValidationSummary,
} from "./types";

export type ImbCountryReference = {
  iso3: string;
  displayName: string;
  alternativeNames: string[];
};

export type ImbRopReference = {
  rop1Code: string | null;
  rop2Code: string | null;
  rop25Code: string | null;
  rop3Code: string;
  status: "Active" | "Inactive";
  joinIssue: string | null;
  joinIssueLabel: string | null;
};

export type FormImbRowsInput = {
  connectionId: string;
  sourceRunId: string;
  columns: CsvColumn[];
  rows: Record<string, string>[];
  countries: ImbCountryReference[];
  ropEntries: ImbRopReference[];
};

export type FormImbRowsResult = {
  columns: CsvColumn[];
  rows: Record<string, string>[];
  findings: ImbFormingFinding[];
  validation: ImbFormingValidationSummary;
  fieldContractChecksum: string;
  transformationChecksum: string;
  outputChecksum: string;
  valid: boolean;
};

const BLANK_VALUES = new Set(["", "-", "–", "—", "na", "n/a", "none", "null"]);
const TRUE_VALUES = new Set([
  "1",
  "true",
  "yes",
  "y",
  "engaged",
  "indigenous",
  "available",
]);
const FALSE_VALUES = new Set([
  "0",
  "false",
  "no",
  "n",
  "unengaged",
  "diaspora",
  "not available",
  "unavailable",
]);

export function checksumImbValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function getImbFieldContractChecksum() {
  return checksumImbValue({
    version: IMB_FIELD_CONTRACT_VERSION,
    source: "AX Data IMB mapping 20260128_122550 with written scripture restored",
    fields: IMB_FIELD_CONTRACT,
  });
}

export function getImbTransformationChecksum() {
  return checksumImbValue({
    version: IMB_FORMING_TRANSFORMATION_VERSION,
    fieldContractChecksum: getImbFieldContractChecksum(),
    countryRulesVersion: 1,
    ropRulesVersion: 1,
    conversionRulesVersion: 1,
    identityRulesVersion: 1,
  });
}

function normalizeLookup(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

function normalizeIdentifier(value: string) {
  return value.normalize("NFKC").trim();
}

function isBlank(value: string) {
  return BLANK_VALUES.has(normalizeLookup(value));
}

function canonicalizeValue(entry: ImbFieldContractEntry, rawValue: string) {
  const trimmed = rawValue.normalize("NFKC").trim();
  if (isBlank(trimmed)) {
    return { value: "", invalid: false };
  }

  if (entry.type === "string" || entry.type === "identifier") {
    return { value: trimmed, invalid: false };
  }

  if (entry.type === "boolean") {
    const key = normalizeLookup(trimmed);
    if (TRUE_VALUES.has(key)) return { value: "TRUE", invalid: false };
    if (FALSE_VALUES.has(key)) return { value: "FALSE", invalid: false };
    return { value: "", invalid: true };
  }

  if (entry.type === "integer") {
    const normalized = trimmed.replace(/[\s,]/gu, "");
    if (/^[+-]?\d+$/u.test(normalized)) {
      return { value: String(Number.parseInt(normalized, 10)), invalid: false };
    }
    return { value: "", invalid: true };
  }

  const normalized = trimmed.replaceAll(",", "");
  const number = Number(normalized);
  if (Number.isFinite(number)) {
    return { value: String(number), invalid: false };
  }
  return { value: "", invalid: true };
}

function addFinding(
  findings: ImbFormingFinding[],
  finding: Omit<ImbFormingFinding, "details"> & {
    details?: Record<string, unknown>;
  },
) {
  findings.push({ ...finding, details: finding.details ?? {} });
}

function buildColumnIndexes(columns: CsvColumn[]) {
  const exact = new Map(columns.map((column) => [column.label, column.key]));
  const normalized = new Map(
    columns.map((column) => [normalizeLookup(column.label), column.key]),
  );
  return {
    get(label: string) {
      return exact.get(label) ?? normalized.get(normalizeLookup(label)) ?? null;
    },
  };
}

function outputKeyByField(columns: CsvColumn[]) {
  return new Map(columns.map((column) => [column.label, column.key]));
}

function buildCountryIndexes(countries: ImbCountryReference[]) {
  const byIso3 = new Map<string, ImbCountryReference>();
  const byName = new Map<string, ImbCountryReference>();
  for (const country of countries) {
    const iso3 = country.iso3.trim().toUpperCase();
    if (iso3) byIso3.set(iso3, country);
    for (const name of [country.displayName, ...country.alternativeNames]) {
      const key = normalizeLookup(name);
      if (key && !byName.has(key)) byName.set(key, country);
    }
  }
  return { byIso3, byName };
}

function buildRopIndex(entries: ImbRopReference[]) {
  const byRop3 = new Map<string, ImbRopReference>();
  const conflicts = new Set<string>();
  for (const entry of entries) {
    const code = normalizeIdentifier(entry.rop3Code);
    const prior = byRop3.get(code);
    if (prior && JSON.stringify(prior) !== JSON.stringify(entry)) conflicts.add(code);
    else if (!prior) byRop3.set(code, entry);
  }
  return { byRop3, conflicts };
}

export function formImbRows(input: FormImbRowsInput): FormImbRowsResult {
  const findings: ImbFormingFinding[] = [];
  const sourceColumns = buildColumnIndexes(input.columns);
  const outputColumns = normalizeHeaders(
    IMB_FIELD_CONTRACT.map((entry) => entry.outputField),
  );
  const outputKeys = outputKeyByField(outputColumns);
  const contractSourceFields = new Set(
    IMB_FIELD_CONTRACT.flatMap((entry) =>
      entry.sourceField ? [entry.sourceField] : [],
    ),
  );

  for (const entry of IMB_FIELD_CONTRACT) {
    if (
      entry.sourceField &&
      entry.requiredSourceColumn &&
      !sourceColumns.get(entry.sourceField)
    ) {
      addFinding(findings, {
        severity: "error",
        ruleCode: "missing-required-source-field",
        sourceRowIndex: null,
        stableRowKey: null,
        fieldName: entry.sourceField,
        sourceValue: null,
        canonicalValue: entry.outputField,
        message: `Required IMB source field ${entry.sourceField} is missing.`,
      });
    }
  }

  if (!sourceColumns.get("OBJECTID")) {
    addFinding(findings, {
      severity: "error",
      ruleCode: "missing-object-id-field",
      sourceRowIndex: null,
      stableRowKey: null,
      fieldName: "OBJECTID",
      sourceValue: null,
      canonicalValue: null,
      message: "IMB source output is missing the ArcGIS OBJECTID field.",
    });
  }

  const schemaDriftFields = input.columns
    .map((column) => column.label)
    .filter(
      (label) =>
        !contractSourceFields.has(label) &&
        !IMB_KNOWN_EXCLUDED_SOURCE_FIELDS.has(label),
    )
    .sort((first, second) => first.localeCompare(second));
  for (const field of schemaDriftFields) {
    addFinding(findings, {
      severity: "warning",
      ruleCode: "source-schema-drift",
      sourceRowIndex: null,
      stableRowKey: null,
      fieldName: field,
      sourceValue: null,
      canonicalValue: null,
      message: `IMB supplied uncontracted source field ${field}; it remains in the raw artifact only.`,
    });
  }

  const countries = buildCountryIndexes(input.countries);
  const rop = buildRopIndex(input.ropEntries);
  for (const code of [...rop.conflicts].sort()) {
    addFinding(findings, {
      severity: "error",
      ruleCode: "ambiguous-rop-reference",
      sourceRowIndex: null,
      stableRowKey: null,
      fieldName: "PG_ROP3",
      sourceValue: code,
      canonicalValue: null,
      message: `Pinned ROP resource has conflicting hierarchy rows for ${code}.`,
    });
  }

  const seenRowKeys = new Map<string, number>();
  const domainKeys = new Map<string, number>();
  const rows = input.rows.map((sourceRow, sourceRowIndex) => {
    const objectIdKey = sourceColumns.get("OBJECTID");
    const objectId = objectIdKey
      ? normalizeIdentifier(sourceRow[objectIdKey] ?? "")
      : "";
    const stableRowKey = objectId
      ? `${IMB_DATA_SOURCE_CODE}:${input.connectionId}:${objectId}`
      : null;

    if (!objectId) {
      addFinding(findings, {
        severity: "error",
        ruleCode: "missing-object-id",
        sourceRowIndex,
        stableRowKey: null,
        fieldName: "OBJECTID",
        sourceValue: objectId,
        canonicalValue: null,
        message: "IMB row is missing its ArcGIS OBJECTID.",
      });
    } else if (seenRowKeys.has(stableRowKey!)) {
      addFinding(findings, {
        severity: "error",
        ruleCode: "duplicate-object-id",
        sourceRowIndex,
        stableRowKey,
        fieldName: "OBJECTID",
        sourceValue: objectId,
        canonicalValue: null,
        message: `IMB OBJECTID ${objectId} appears more than once.`,
        details: { firstSourceRowIndex: seenRowKeys.get(stableRowKey!) },
      });
    } else {
      seenRowKeys.set(stableRowKey!, sourceRowIndex);
    }

    const formed = Object.fromEntries(outputColumns.map((column) => [column.key, ""]));
    for (const entry of IMB_FIELD_CONTRACT) {
      if (!entry.sourceField) continue;
      const sourceKey = sourceColumns.get(entry.sourceField);
      const rawValue = sourceKey ? sourceRow[sourceKey] ?? "" : "";
      const converted = canonicalizeValue(entry, rawValue);
      formed[outputKeys.get(entry.outputField)!] = converted.value;
      if (converted.invalid) {
        addFinding(findings, {
          severity: "warning",
          ruleCode: "invalid-optional-value",
          sourceRowIndex,
          stableRowKey,
          fieldName: entry.outputField,
          sourceValue: rawValue,
          canonicalValue: "",
          message: `${entry.outputField} could not be converted to ${entry.type}.`,
        });
      }
    }

    formed[outputKeys.get("Data_Source")!] = IMB_DATA_SOURCE_CODE;
    formed[outputKeys.get("Dataset_ID")!] = input.sourceRunId;
    formed[outputKeys.get("Dataset_Row_ID")!] = objectId;
    formed[outputKeys.get("Dataset_Row_Key")!] = stableRowKey ?? "";

    const isoKey = outputKeys.get("Geo_ISO3")!;
    const countryKey = outputKeys.get("Geo_Country_Name")!;
    const sourceIso3 = formed[isoKey].toUpperCase();
    const sourceCountry = formed[countryKey];
    const countryByIso = countries.byIso3.get(sourceIso3);
    const countryByName = countries.byName.get(normalizeLookup(sourceCountry));

    if (countryByIso) {
      formed[isoKey] = countryByIso.iso3.toUpperCase();
      formed[countryKey] = countryByIso.displayName;
      if (
        countryByName &&
        countryByName.iso3.toUpperCase() !== countryByIso.iso3.toUpperCase()
      ) {
        addFinding(findings, {
          severity: "warning",
          ruleCode: "country-iso-conflict",
          sourceRowIndex,
          stableRowKey,
          fieldName: "Geo_ISO3",
          sourceValue: `${sourceIso3} / ${sourceCountry}`,
          canonicalValue: `${countryByIso.iso3.toUpperCase()} / ${countryByIso.displayName}`,
          message: "Source country text conflicts with a valid source ISO3; ISO3 was retained.",
          details: { countryTextIso3: countryByName.iso3.toUpperCase() },
        });
      }
    } else if (!sourceIso3 && countryByName) {
      formed[isoKey] = countryByName.iso3.toUpperCase();
      formed[countryKey] = countryByName.displayName;
    } else {
      addFinding(findings, {
        severity: "warning",
        ruleCode: "unresolved-country",
        sourceRowIndex,
        stableRowKey,
        fieldName: "Geo_ISO3",
        sourceValue: `${sourceIso3} / ${sourceCountry}`.trim(),
        canonicalValue: null,
        message: "Country and ISO3 could not be resolved exactly from the pinned resource.",
      });
    }

    const rop1Key = outputKeys.get("PG_ROP1")!;
    const rop2Key = outputKeys.get("PG_ROP2")!;
    const rop25Key = outputKeys.get("PG_ROP25")!;
    const rop3Key = outputKeys.get("PG_ROP3")!;
    const sourceParents = {
      rop1: formed[rop1Key],
      rop2: formed[rop2Key],
      rop25: formed[rop25Key],
    };
    const sourceRop3 = normalizeIdentifier(formed[rop3Key]);
    const matchedRop = rop.byRop3.get(sourceRop3);
    if (sourceRop3 && matchedRop && !rop.conflicts.has(sourceRop3)) {
      formed[rop1Key] = matchedRop.rop1Code ?? "";
      formed[rop2Key] = matchedRop.rop2Code ?? "";
      formed[rop25Key] = matchedRop.rop25Code ?? "";
      const canonicalParents = {
        rop1: formed[rop1Key],
        rop2: formed[rop2Key],
        rop25: formed[rop25Key],
      };
      if (
        (sourceParents.rop1 && sourceParents.rop1 !== canonicalParents.rop1) ||
        (sourceParents.rop2 && sourceParents.rop2 !== canonicalParents.rop2) ||
        (sourceParents.rop25 && sourceParents.rop25 !== canonicalParents.rop25)
      ) {
        addFinding(findings, {
          severity: "warning",
          ruleCode: "rop-parent-conflict",
          sourceRowIndex,
          stableRowKey,
          fieldName: "PG_ROP3",
          sourceValue: sourceRop3,
          canonicalValue: sourceRop3,
          message: "Source ROP parents differ from the pinned ROP3 hierarchy.",
          details: { sourceParents, canonicalParents },
        });
      }
      if (matchedRop.status === "Inactive" || matchedRop.joinIssue) {
        addFinding(findings, {
          severity: "warning",
          ruleCode: matchedRop.status === "Inactive" ? "inactive-rop3" : "rop-resource-join-issue",
          sourceRowIndex,
          stableRowKey,
          fieldName: "PG_ROP3",
          sourceValue: sourceRop3,
          canonicalValue: sourceRop3,
          message:
            matchedRop.status === "Inactive"
              ? "ROP3 resolves to an inactive pinned resource entry."
              : matchedRop.joinIssueLabel ?? "ROP3 resolves with a pinned resource join warning.",
          details: { joinIssue: matchedRop.joinIssue },
        });
      }
    } else {
      formed[rop1Key] = "";
      formed[rop2Key] = "";
      formed[rop25Key] = "";
      addFinding(findings, {
        severity: "warning",
        ruleCode: "unresolved-rop3",
        sourceRowIndex,
        stableRowKey,
        fieldName: "PG_ROP3",
        sourceValue: sourceRop3,
        canonicalValue: null,
        message: sourceRop3
          ? "ROP3 was not found exactly in the pinned resource."
          : "ROP3 is blank and remains unresolved.",
        details: { sourceParents },
      });
    }

    const peid = formed[outputKeys.get("PG_PEID")!];
    const acceptedIso3 = formed[isoKey];
    if (peid && acceptedIso3) {
      const domainKey = `${peid}||${acceptedIso3}`;
      if (domainKeys.has(domainKey)) {
        addFinding(findings, {
          severity: "warning",
          ruleCode: "duplicate-logical-person-country",
          sourceRowIndex,
          stableRowKey,
          fieldName: "PG_PEID",
          sourceValue: domainKey,
          canonicalValue: domainKey,
          message: "PEID and accepted ISO3 duplicate an earlier IMB logical record.",
          details: { firstSourceRowIndex: domainKeys.get(domainKey) },
        });
      } else {
        domainKeys.set(domainKey, sourceRowIndex);
      }
    }

    return formed;
  });

  if (rows.length !== input.rows.length) {
    addFinding(findings, {
      severity: "error",
      ruleCode: "row-count-divergence",
      sourceRowIndex: null,
      stableRowKey: null,
      fieldName: null,
      sourceValue: String(input.rows.length),
      canonicalValue: String(rows.length),
      message: "Formed row count does not match the source row count.",
    });
  }

  const validation: ImbFormingValidationSummary = {
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    errorCount: findings.filter((finding) => finding.severity === "error").length,
    unresolvedCountryRows: findings.filter((finding) => finding.ruleCode === "unresolved-country").length,
    unresolvedRopRows: findings.filter((finding) => finding.ruleCode === "unresolved-rop3").length,
    countryConflictRows: findings.filter((finding) => finding.ruleCode === "country-iso-conflict").length,
    ropParentConflictRows: findings.filter((finding) => finding.ruleCode === "rop-parent-conflict").length,
    invalidValueCount: findings.filter((finding) => finding.ruleCode === "invalid-optional-value").length,
    schemaDriftFields,
  };
  const outputChecksum = checksumImbValue({ columns: outputColumns, rows });

  return {
    columns: outputColumns,
    rows,
    findings,
    validation,
    fieldContractChecksum: getImbFieldContractChecksum(),
    transformationChecksum: getImbTransformationChecksum(),
    outputChecksum,
    valid: validation.errorCount === 0,
  };
}
