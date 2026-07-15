import type { CsvColumn } from "@/lib/api-types";
import { escapeCsvCell } from "@/lib/csv";

import {
  JOSHUA_PROJECT_HEADERS,
  PARTNER_EXPORT_MAX_BYTES,
  PARTNER_EXPORT_MAX_ROWS,
  PARTNER_EXPORT_PREVIEW_ROW_LIMIT,
  PartnerExportError,
  type PartnerExportColumnInput,
  type PartnerExportCrosswalkEntry,
  type PartnerExportPartnerKey,
  type PartnerExportPreview,
  type PartnerExportProfileRevision,
  type PartnerExportValidationFinding,
  type PartnerExportValidationSeverity,
  type PartnerExportValidationSummary,
} from "./types";
export { createJoshuaProjectColumns } from "./templates";

type SourceRow = {
  rowIndex: number;
  data: Record<string, string>;
};

const MAX_FINDINGS = 250;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;
const WHOLE_NUMBER_PATTERN = /^-?\d+(?:\.0+)?$/u;
const NON_NEGATIVE_WHOLE_NUMBER_PATTERN = /^\d+(?:\.0+)?$/u;

type FindingAccumulator = {
  findings: PartnerExportValidationFinding[];
  totalCount: number;
  errorCount: number;
  warningCount: number;
};

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase();
}

function normalizeWholeNumber(value: string, nonNegative: boolean) {
  const trimmed = value.trim();
  const pattern = nonNegative
    ? NON_NEGATIVE_WHOLE_NUMBER_PATTERN
    : WHOLE_NUMBER_PATTERN;

  if (!pattern.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/\.0+$/u, "");
}

function normalizeIsoTimestamp(value: string) {
  const trimmed = value.trim();

  if (ISO_DATE_PATTERN.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== trimmed
      ? null
      : trimmed;
  }

  if (!ISO_TIMESTAMP_PATTERN.test(trimmed)) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function getRawValue(row: SourceRow, column: PartnerExportColumnInput) {
  if (column.transform === "literal") {
    return column.literalValue ?? "";
  }

  if (column.transform === "coalesce") {
    for (const sourceKey of column.sourceColumnKeys) {
      const candidate = row.data[sourceKey]?.trim() ?? "";

      if (candidate) {
        return candidate;
      }
    }

    return "";
  }

  return row.data[column.sourceColumnKeys[0] ?? ""]?.trim() ?? "";
}

function transformValue(input: {
  row: SourceRow;
  column: PartnerExportColumnInput;
}): { value: string; finding: PartnerExportValidationFinding | null } {
  const rawValue = getRawValue(input.row, input.column);

  if (!rawValue) {
    return { value: "", finding: null };
  }

  if (
    input.column.transform === "copy" ||
    input.column.transform === "coalesce" ||
    input.column.transform === "literal"
  ) {
    return { value: rawValue.trim(), finding: null };
  }

  if (input.column.transform === "whole_number") {
    const value = normalizeWholeNumber(rawValue, false);
    return value === null
      ? {
          value: "",
          finding: {
            severity: "error",
            code: "invalid_whole_number",
            rowIndex: input.row.rowIndex,
            outputHeader: input.column.outputHeader,
            message: "Value is not an unambiguous whole number.",
          },
        }
      : { value, finding: null };
  }

  if (input.column.transform === "non_negative_whole_number") {
    const value = normalizeWholeNumber(rawValue, true);
    return value === null
      ? {
          value: "",
          finding: {
            severity: "error",
            code: "invalid_non_negative_whole_number",
            rowIndex: input.row.rowIndex,
            outputHeader: input.column.outputHeader,
            message: "Value is not an unambiguous non-negative whole number.",
          },
        }
      : { value, finding: null };
  }

  const value = normalizeIsoTimestamp(rawValue);
  return value === null
    ? {
        value: "",
        finding: {
          severity: "error",
          code: "invalid_iso_timestamp",
          rowIndex: input.row.rowIndex,
          outputHeader: input.column.outputHeader,
          message: "Value is not an unambiguous ISO-8601 date or timestamp.",
        },
      }
    : { value, finding: null };
}

function addFinding(
  accumulator: FindingAccumulator,
  finding: PartnerExportValidationFinding,
) {
  accumulator.totalCount += 1;
  accumulator[finding.severity === "error" ? "errorCount" : "warningCount"] += 1;

  if (accumulator.findings.length < MAX_FINDINGS) {
    accumulator.findings.push(finding);
  }
}

function validateJoshuaProjectRow(input: {
  rowIndex: number;
  outputRow: Record<string, string>;
  accumulator: FindingAccumulator;
}) {
  if (!input.outputRow.PG_PeopleID3 && !input.outputRow.PG_ROP3) {
    addFinding(input.accumulator, {
      severity: "error",
      code: "required_identifier",
      rowIndex: input.rowIndex,
      outputHeader: "PG_PeopleID3 / PG_ROP3",
      message: "Joshua Project requires at least one people-group identifier.",
    });
  }

  if (!input.outputRow.Geo_ROG3 && !input.outputRow.Geo_ISO3) {
    addFinding(input.accumulator, {
      severity: "error",
      code: "required_geography",
      rowIndex: input.rowIndex,
      outputHeader: "Geo_ROG3 / Geo_ISO3",
      message: "Joshua Project requires at least one geography identifier.",
    });
  }
}

function summarizeFindings(
  accumulator: FindingAccumulator,
): PartnerExportValidationSummary {
  return {
    errorCount: accumulator.errorCount,
    warningCount: accumulator.warningCount,
    findings: accumulator.findings,
    truncated: accumulator.totalCount > accumulator.findings.length,
  };
}

export function validateProfileColumns(input: {
  columns: PartnerExportColumnInput[];
  sourceColumns: CsvColumn[];
  partnerKey: PartnerExportPartnerKey;
}) {
  const errors: string[] = [];
  const sourceKeys = new Set(input.sourceColumns.map((column) => column.key));
  const targetHeaders = new Set<string>();

  if (input.columns.length === 0 || input.columns.length > 500) {
    errors.push("Choose between 1 and 500 output columns.");
  }

  input.columns.forEach((column, index) => {
    const outputHeader = column.outputHeader.trim();
    const normalizedOutputHeader = normalizeHeader(outputHeader);

    if (!outputHeader || outputHeader.length > 128) {
      errors.push(`Column ${index + 1} needs an output header of 128 characters or fewer.`);
    } else if (targetHeaders.has(normalizedOutputHeader)) {
      errors.push(`Output header \"${outputHeader}\" is duplicated.`);
    } else {
      targetHeaders.add(normalizedOutputHeader);
    }

    if (!column.sourceColumnKeys.every((sourceKey) => sourceKeys.has(sourceKey))) {
      errors.push(`Output header \"${outputHeader}\" references a missing source column.`);
    }

    if (column.transform === "literal") {
      if (column.sourceColumnKeys.length > 0) {
        errors.push(`Literal output \"${outputHeader}\" cannot reference source columns.`);
      }
    } else if (column.transform === "coalesce") {
      if (column.sourceColumnKeys.length < 2) {
        errors.push(`Coalesced output \"${outputHeader}\" requires at least two source columns.`);
      }
    } else if (column.sourceColumnKeys.length !== 1) {
      errors.push(`Output \"${outputHeader}\" requires exactly one source column.`);
    }
  });

  if (input.partnerKey === "joshua-project") {
    const headers = input.columns.map((column) => column.outputHeader.trim());
    if (
      headers.length !== JOSHUA_PROJECT_HEADERS.length ||
      headers.some((header, index) => header !== JOSHUA_PROJECT_HEADERS[index])
    ) {
      errors.push("Joshua Project profiles must keep the exact required header order.");
    }

    for (const requiredHeader of ["PG_AX_unique_PG_ID_PGIC", "PG_Name_Main"]) {
      const column = input.columns.find(
        (candidate) => candidate.outputHeader === requiredHeader,
      );
      if (!column?.required || column.requiredSeverity !== "error") {
        errors.push(
          `Joshua Project requires "${requiredHeader}" as a blocking field.`,
        );
      }
    }
  }

  return errors;
}

export function transformPartnerExportRows(input: {
  rows: SourceRow[];
  profile: PartnerExportProfileRevision;
  sourceColumns: CsvColumn[];
}) {
  if (input.rows.length > PARTNER_EXPORT_MAX_ROWS) {
    throw new PartnerExportError(
      `Partner exports are limited to ${PARTNER_EXPORT_MAX_ROWS.toLocaleString()} rows.`,
      413,
    );
  }

  const configurationErrors = validateProfileColumns({
    columns: input.profile.columns,
    sourceColumns: input.sourceColumns,
    partnerKey: input.profile.partnerKey,
  });

  if (configurationErrors.length > 0) {
    throw new PartnerExportError(configurationErrors[0], 409);
  }

  const accumulator: FindingAccumulator = {
    findings: [],
    totalCount: 0,
    errorCount: 0,
    warningCount: 0,
  };
  const rows = input.rows.map((sourceRow) => {
    const outputRow: Record<string, string> = {};

    for (const column of input.profile.columns) {
      const transformed = transformValue({ row: sourceRow, column });
      outputRow[column.outputHeader] = transformed.value;

      if (transformed.finding) {
        addFinding(accumulator, transformed.finding);
      }

      if (column.required && !transformed.value) {
        addFinding(accumulator, {
          severity: column.requiredSeverity,
          code: "required",
          rowIndex: sourceRow.rowIndex,
          outputHeader: column.outputHeader,
          message: "A required mapped value is blank.",
        });
      }
    }

    if (input.profile.partnerKey === "joshua-project") {
      validateJoshuaProjectRow({
        rowIndex: sourceRow.rowIndex,
        outputRow,
        accumulator,
      });
    }

    return outputRow;
  });

  return {
    rows,
    validation: summarizeFindings(accumulator),
  };
}

export function getPartnerExportCrosswalk(
  columns: PartnerExportProfileRevision["columns"],
): PartnerExportCrosswalkEntry[] {
  return columns.map((column) => ({
    ordinal: column.ordinal,
    outputHeader: column.outputHeader,
    sourceColumnKeys: column.sourceColumnKeys,
    sourceLabels: column.sourceLabelSnapshot,
    transform: column.transform,
    required: column.required,
    requiredSeverity: column.requiredSeverity,
  }));
}

export function buildPartnerExportPreview(input: {
  rows: SourceRow[];
  profile: PartnerExportProfileRevision;
  sourceColumns: CsvColumn[];
  previewRowLimit?: number;
}): PartnerExportPreview {
  const transformed = transformPartnerExportRows(input);
  const previewRowLimit = Math.min(
    PARTNER_EXPORT_PREVIEW_ROW_LIMIT,
    Math.max(1, input.previewRowLimit ?? PARTNER_EXPORT_PREVIEW_ROW_LIMIT),
  );

  return {
    headers: input.profile.columns.map((column) => column.outputHeader),
    rows: transformed.rows.slice(0, previewRowLimit),
    sourceRowCount: input.rows.length,
    previewRowCount: Math.min(transformed.rows.length, previewRowLimit),
    crosswalk: getPartnerExportCrosswalk(input.profile.columns),
    validation: transformed.validation,
  };
}

export function serializePartnerExportCsv(input: {
  rows: Array<Record<string, string>>;
  headers: string[];
}) {
  const lines = [input.headers.map(escapeCsvCell).join(",")];
  for (const row of input.rows) {
    lines.push(
      input.headers.map((header) => escapeCsvCell(row[header] ?? "")).join(","),
    );
  }
  const csv = `${lines.join("\r\n")}\r\n`;

  if (Buffer.byteLength(csv, "utf8") > PARTNER_EXPORT_MAX_BYTES) {
    throw new PartnerExportError("Partner export exceeds the 25 MiB limit.", 413);
  }

  return csv;
}

export function hasBlockingPartnerExportErrors(
  validation: PartnerExportValidationSummary,
) {
  return validation.errorCount > 0;
}

export function hasPartnerExportWarnings(
  validation: PartnerExportValidationSummary,
) {
  return validation.warningCount > 0;
}

export function createRequiredFinding(input: {
  severity: PartnerExportValidationSeverity;
  rowIndex: number;
  outputHeader: string;
}) {
  return {
    severity: input.severity,
    code: "required" as const,
    rowIndex: input.rowIndex,
    outputHeader: input.outputHeader,
    message: "A required mapped value is blank.",
  };
}
