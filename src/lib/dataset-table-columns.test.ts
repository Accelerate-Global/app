import { describe, expect, it } from "vitest";

import type {
  DatasetSummary,
  FieldDefinitionPresentation,
} from "@/lib/api-types";

import { getSortedVisibleDatasetColumns } from "./dataset-table-columns";

type DatasetColumn = DatasetSummary["columns"][number];

function sortVisibleColumns(input: {
  columns: DatasetColumn[];
  hiddenColumnKeys?: string[];
  fieldDefinitionPresentationByColumnKey?: Record<
    string,
    FieldDefinitionPresentation
  >;
}) {
  return getSortedVisibleDatasetColumns({
    columns: input.columns,
    hiddenColumnKeys: input.hiddenColumnKeys ?? [],
    fieldDefinitionPresentationByColumnKey:
      input.fieldDefinitionPresentationByColumnKey ?? {},
  }).map((column) => column.key);
}

describe("dataset-table-columns", () => {
  it("prepends the requested preferred datasheet prefix before alphabetical columns", () => {
    const columns: DatasetColumn[] = [
      { key: "zeta", label: "Zeta", sourceIndex: 7 },
      { key: "geo_country_name", label: "Country", sourceIndex: 2 },
      { key: "christianity_frontier_group", label: "Frontier", sourceIndex: 5 },
      { key: "alpha_misc", label: "Alpha", sourceIndex: 6 },
      { key: "pg_rop3", label: "ROP3", sourceIndex: 0 },
      { key: "people_name", label: "People Name", sourceIndex: 1 },
      { key: "alternate_countries", label: "countries", sourceIndex: 3 },
      { key: "christianity_gsec", label: "GSEC", sourceIndex: 4 },
    ];

    expect(sortVisibleColumns({ columns })).toEqual([
      "pg_rop3",
      "people_name",
      "geo_country_name",
      "alternate_countries",
      "christianity_gsec",
      "christianity_frontier_group",
      "alpha_misc",
      "zeta",
    ]);
  });

  it("matches priority fields through raw labels and effective display labels", () => {
    const columns: DatasetColumn[] = [
      { key: "custom-rop3", label: "ROP3#", sourceIndex: 0 },
      { key: "custom-main-country", label: "Geo", sourceIndex: 2 },
      { key: "custom-frontier", label: "Frontier", sourceIndex: 5 },
      { key: "custom-alt-country", label: "countries", sourceIndex: 3 },
      { key: "custom-gsec", label: "Watchlist", sourceIndex: 4 },
      { key: "custom-pg-name", label: "Name", sourceIndex: 1 },
    ];

    expect(
      sortVisibleColumns({
        columns,
        fieldDefinitionPresentationByColumnKey: {
          "custom-main-country": {
            definition: "",
            displayLabel: "Main Country Name",
            effectiveLabel: "Main Country Name",
            linkedSources: [],
          },
          "custom-gsec": {
            definition: "",
            displayLabel: "GSEC Status",
            effectiveLabel: "GSEC Status",
            linkedSources: [],
          },
          "custom-pg-name": {
            definition: "",
            displayLabel: "PG Name",
            effectiveLabel: "PG Name",
            linkedSources: [],
          },
        },
      }),
    ).toEqual([
      "custom-rop3",
      "custom-pg-name",
      "custom-main-country",
      "custom-alt-country",
      "custom-gsec",
      "custom-frontier",
    ]);
  });

  it("skips missing priority fields and keeps the remaining columns alphabetized", () => {
    const columns: DatasetColumn[] = [
      { key: "misc-zeta", label: "Zeta", sourceIndex: 4 },
      { key: "christianity_frontier_group", label: "Frontier", sourceIndex: 2 },
      { key: "misc-alpha", label: "Alpha", sourceIndex: 3 },
      { key: "geo_country_name", label: "Country", sourceIndex: 1 },
    ];

    expect(sortVisibleColumns({ columns })).toEqual([
      "geo_country_name",
      "christianity_frontier_group",
      "misc-alpha",
      "misc-zeta",
    ]);
  });

  it("omits hidden priority fields from the preferred prefix", () => {
    const columns: DatasetColumn[] = [
      { key: "pg_rop3", label: "ROP3", sourceIndex: 0 },
      { key: "people_name", label: "People Name", sourceIndex: 1 },
      { key: "misc-alpha", label: "Alpha", sourceIndex: 2 },
    ];

    expect(
      sortVisibleColumns({
        columns,
        hiddenColumnKeys: ["pg_rop3"],
      }),
    ).toEqual(["people_name", "misc-alpha"]);
  });

  it("keeps duplicate matches within the same priority slot ordered by source index", () => {
    const columns: DatasetColumn[] = [
      { key: "later-pg-name", label: "Name", sourceIndex: 10 },
      { key: "misc-alpha", label: "Alpha", sourceIndex: 3 },
      { key: "earlier-pg-name", label: "Name", sourceIndex: 2 },
    ];

    expect(
      sortVisibleColumns({
        columns,
        fieldDefinitionPresentationByColumnKey: {
          "later-pg-name": {
            definition: "",
            displayLabel: "PG Name",
            effectiveLabel: "PG Name",
            linkedSources: [],
          },
          "earlier-pg-name": {
            definition: "",
            displayLabel: "PG Name",
            effectiveLabel: "PG Name",
            linkedSources: [],
          },
        },
      }),
    ).toEqual(["earlier-pg-name", "later-pg-name", "misc-alpha"]);
  });
});
