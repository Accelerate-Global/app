import { describe, expect, it } from "vitest";

import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
} from "@/lib/api-types";
import { serializeDatasetRowsToCsv } from "@/lib/dataset-download";

const columns = [
  { key: "name", label: "Name", sourceIndex: 0 },
  { key: "notes", label: "Notes", sourceIndex: 1 },
] satisfies DatasetSummary["columns"];

const rows = [
  {
    id: "row-1",
    rowIndex: 0,
    data: {
      name: "=HYPERLINK(\"https://evil.test\")",
      notes: "ordinary",
    },
  },
  {
    id: "row-2",
    rowIndex: 1,
    data: {
      name: "Alpha",
      notes: "Line \"two\"\nwrapped",
    },
  },
] satisfies DatasetRowsResponse["rows"];

const fieldDefinitionPresentationByColumnKey: Record<
  string,
  FieldDefinitionPresentation
> = {};

describe("dataset CSV downloads", () => {
  it("neutralizes spreadsheet formula cells while preserving CSV quoting", () => {
    expect(
      serializeDatasetRowsToCsv({
        rows,
        visibleColumns: columns,
        fieldDefinitionPresentationByColumnKey,
      }),
    ).toBe(
      "Row number,Name,Notes\r\n" +
        "1,\"'=HYPERLINK(\"\"https://evil.test\"\")\",ordinary\r\n" +
        "2,Alpha,\"Line \"\"two\"\"\nwrapped\"\r\n",
    );
  });
});
