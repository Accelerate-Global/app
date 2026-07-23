import { normalizeHeaders } from "@/lib/csv";

import type {
  SourceCountryReference,
  SourceFormingContract,
  SourceJpPeopleId3Reference,
  SourceRopReference,
} from "./types";

export const SOURCE_FORMING_COUNTRIES: readonly SourceCountryReference[] = [
  {
    iso3: "USA",
    displayName: "United States",
    alternativeNames: ["United States of America", "US"],
  },
  {
    iso3: "CIV",
    displayName: "Côte d’Ivoire",
    alternativeNames: ["Cote d Ivoire", "Ivory Coast"],
  },
  {
    iso3: "IND",
    displayName: "India",
    alternativeNames: ["Republic of India"],
  },
  {
    iso3: "PAK",
    displayName: "Pakistan",
    alternativeNames: ["Islamic Republic of Pakistan"],
  },
];

export const SOURCE_FORMING_ROP_ENTRIES: readonly SourceRopReference[] = [
  {
    rop1Code: "A001",
    rop2Code: "C0001",
    rop25Code: "300001",
    rop3Code: "100001",
    status: "Active",
    joinIssue: null,
    joinIssueLabel: null,
  },
  {
    rop1Code: "A002",
    rop2Code: "C0002",
    rop25Code: "300002",
    rop3Code: "100002",
    status: "Active",
    joinIssue: null,
    joinIssueLabel: null,
  },
];

export const SOURCE_FORMING_JP_CROSSWALK: readonly SourceJpPeopleId3Reference[] = [
  {
    peopleId3: "7001",
    rop3: "100001",
    iso3: "USA",
    active: true,
    parentStatus: "linked",
    missingParentReason: null,
  },
  {
    peopleId3: "7002",
    rop3: null,
    iso3: "CIV",
    active: true,
    parentStatus: "approved-missing",
    missingParentReason: "Provider has no registry parent.",
  },
];

export function sourceRows(rows: readonly Record<string, string>[]) {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const label of Object.keys(row)) {
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
  }
  const columns = normalizeHeaders(labels);
  return {
    columns,
    rows: rows.map((row) =>
      Object.fromEntries(
        columns.map((column) => [column.key, row[column.label] ?? ""]),
      ),
    ),
  };
}

export function outputRowByLabel(input: {
  columns: readonly { key: string; label: string }[];
  rows: readonly Record<string, string>[];
}, rowIndex = 0) {
  return Object.fromEntries(
    input.columns.map((column) => [
      column.label,
      input.rows[rowIndex]?.[column.key] ?? "",
    ]),
  );
}

export function completeExpectedRow(
  contract: SourceFormingContract,
  values: Readonly<Record<string, string>>,
) {
  return Object.fromEntries(
    contract.fields.map((field) => [field.outputField, values[field.outputField] ?? ""]),
  );
}
