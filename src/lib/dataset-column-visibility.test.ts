import { describe, expect, it } from "vitest";

import {
  getVisibleDatasetColumns,
  normalizeDatasetHiddenColumnKeys,
} from "@/lib/dataset-column-visibility";

const columns = [
  { key: "pg_rop3", label: "PG_ROP3", sourceIndex: 0 },
  { key: "alt_countries", label: "alt_countries", sourceIndex: 1 },
  { key: "imb_source", label: "IMB_Source", sourceIndex: 2 },
];

describe("dataset-column-visibility", () => {
  it("normalizes hidden column keys against the dataset column order", () => {
    expect(
      normalizeDatasetHiddenColumnKeys(
        [" imb_source ", "unknown", "alt_countries", "alt_countries"],
        columns,
      ),
    ).toEqual(["alt_countries", "imb_source"]);
  });

  it("returns only visible dataset columns", () => {
    expect(
      getVisibleDatasetColumns(columns, ["alt_countries", "imb_source"]).map(
        (column) => column.key,
      ),
    ).toEqual(["pg_rop3"]);
  });
});
