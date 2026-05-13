import { describe, expect, it } from "vitest";

import {
  chunkRows,
  escapeCsvCell,
  normalizeHeader,
  normalizeHeaderIdentity,
  normalizeHeaders,
  rowArrayToRecord,
  sanitizeFileName,
} from "@/lib/csv";

describe("csv utilities", () => {
  it("normalizes header names into stable keys", () => {
    expect(normalizeHeader(" First Name ", 0)).toBe("first_name");
    expect(normalizeHeader("Total ($)", 1)).toBe("total");
    expect(normalizeHeader("", 2)).toBe("column_3");
  });

  it("normalizes field-definition identities without preserving duplicate key suffixes", () => {
    expect(normalizeHeaderIdentity(" First Name ", 0)).toBe("first_name");
    expect(normalizeHeaderIdentity("first-name", 7)).toBe("first_name");
    expect(normalizeHeaderIdentity("", 2)).toBe("column_3");
  });

  it("deduplicates headers without changing labels", () => {
    const columns = normalizeHeaders(["Name", "name", " Name ", ""]);

    expect(columns).toEqual([
      { key: "name", label: "Name", sourceIndex: 0 },
      { key: "name_2", label: "name", sourceIndex: 1 },
      { key: "name_3", label: "Name", sourceIndex: 2 },
      { key: "column_4", label: "Column 4", sourceIndex: 3 },
    ]);
  });

  it("maps row arrays onto normalized column keys", () => {
    const columns = normalizeHeaders(["A", "B"]);

    expect(rowArrayToRecord(["one", null], columns)).toEqual({
      a: "one",
      b: "",
    });
  });

  it("chunks rows with a bounded batch size", () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("sanitizes uploaded filenames for blob paths", () => {
    expect(sanitizeFileName("sales / april.csv")).toBe("sales-april.csv");
    expect(sanitizeFileName("")).toBe("upload.csv");
  });

  it("neutralizes spreadsheet formula-leading CSV cells", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("  +SUM(A1:A2)")).toBe("'  +SUM(A1:A2)");
    expect(escapeCsvCell("-10")).toBe("'-10");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
    expect(escapeCsvCell("\t=cmd")).toBe("'\t=cmd");
    expect(escapeCsvCell("\r=cmd")).toBe("\"'\r=cmd\"");
    expect(escapeCsvCell("\n=cmd")).toBe("\"'\n=cmd\"");
  });

  it("preserves normal CSV quoting behavior", () => {
    expect(escapeCsvCell("plain value")).toBe("plain value");
    expect(escapeCsvCell("Line \"two\"\nwrapped")).toBe(
      "\"Line \"\"two\"\"\nwrapped\"",
    );
    expect(escapeCsvCell("value,with,commas")).toBe("\"value,with,commas\"");
  });
});
