import type { CsvColumn } from "@/lib/api-types";

import {
  JOSHUA_PROJECT_HEADERS,
  type PartnerExportColumnInput,
  type PartnerExportTransform,
} from "./types";

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase();
}

function getTransformForJoshuaHeader(header: string): PartnerExportTransform {
  if (header === "engage_timestamp_of_last_known") {
    return "iso_timestamp";
  }

  if (
    header === "approx_evangelical_believers" ||
    header === "approx_evangelical_churches"
  ) {
    return "non_negative_whole_number";
  }

  return "copy";
}

export function createJoshuaProjectColumns(
  sourceColumns: CsvColumn[],
): PartnerExportColumnInput[] {
  const byExactLabel = new Map(
    sourceColumns.map((column) => [normalizeHeader(column.label), column]),
  );

  return JOSHUA_PROJECT_HEADERS.map((header) => {
    const source = byExactLabel.get(normalizeHeader(header));
    return {
      outputHeader: header,
      sourceColumnKeys: source ? [source.key] : [],
      sourceLabelSnapshot: source ? [source.label] : [],
      transform: getTransformForJoshuaHeader(header),
      literalValue: null,
      required: ["PG_AX_unique_PG_ID_PGIC", "PG_Name_Main"].includes(header),
      requiredSeverity: "error",
    };
  });
}
