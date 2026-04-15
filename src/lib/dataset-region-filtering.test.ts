import { describe, expect, it } from "vitest";

import type { DatasetRowsResponse, DatasetSummary } from "@/lib/api-types";
import {
  datasetSupportsRegionFiltering,
  datasetSupportsWatchlistFiltering,
  datasetSupportsUupgFiltering,
  filterDatasetRowsByRegion,
  filterDatasetRowsByWatchlist,
  filterDatasetRowsByUupg,
  getEnabledRegionCountryNames,
} from "./dataset-region-filtering";

const rows: DatasetRowsResponse["rows"] = [
  {
    id: "row-1",
    rowIndex: 0,
    data: {
      geo_country_name: "India",
      christianity_gsec: "2",
      christianity_frontier_group: "TRUE",
      engage_global_engagement_anywhere: "FALSE",
    },
  },
  {
    id: "row-2",
    rowIndex: 1,
    data: {
      geo_country_name: "Nepal",
      christianity_gsec: "3",
      christianity_frontier_group: "TRUE",
      engage_global_engagement_anywhere: "TRUE",
    },
  },
  {
    id: "row-3",
    rowIndex: 2,
    data: {
      Geo_Country_Name: "",
      Christianity_GSEC: "",
      Christianity_Frontier_Group: "",
      Engage_Global_Engagement_Anywhere: "",
    },
  },
];

const dataset = {
  id: "dataset-1",
  sortOrder: 0,
  fileName: "Global",
  blobUrl: "https://example.com/dataset.csv",
  blobPath: "datasets/global.csv",
  isPrimary: true,
  status: "ready",
  rowCount: 2,
  sizeBytes: 512,
  columns: [
    {
      key: "geo_country_name",
      label: "Geo_Country_Name",
      sourceIndex: 0,
    },
    {
      key: "christianity_gsec",
      label: "Christianity_GSEC",
      sourceIndex: 1,
    },
    {
      key: "christianity_frontier_group",
      label: "Christianity_Frontier_Group",
      sourceIndex: 2,
    },
    {
      key: "engage_global_engagement_anywhere",
      label: "Engage_Global_Engagement_Anywhere",
      sourceIndex: 3,
    },
  ],
  hiddenColumnKeys: [],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies DatasetSummary;

describe("dataset-region-filtering", () => {
  it("detects support when the dataset stores normalized column keys", () => {
    expect(datasetSupportsRegionFiltering(dataset)).toBe(true);
  });

  it("detects UUPG support when the dataset stores normalized column keys", () => {
    expect(datasetSupportsUupgFiltering(dataset)).toBe(true);
  });

  it("detects watchlist support when the dataset stores normalized column keys", () => {
    expect(datasetSupportsWatchlistFiltering(dataset)).toBe(true);
  });

  it("detects UUPG support when the dataset exposes the raw header as the label", () => {
    expect(
      datasetSupportsUupgFiltering({
        ...dataset,
        columns: [
          {
            key: "engagement_status",
            label: "Engage_Global_Engagement_Anywhere",
            sourceIndex: 0,
          },
        ],
      }),
    ).toBe(true);
  });

  it("reports UUPG filtering as unsupported when the column is absent", () => {
    expect(
      datasetSupportsUupgFiltering({
        ...dataset,
        columns: [
          {
            key: "geo_country_name",
            label: "Geo_Country_Name",
            sourceIndex: 0,
          },
        ],
      }),
    ).toBe(false);
  });

  it("detects watchlist support when the dataset exposes the raw header as the label", () => {
    expect(
      datasetSupportsWatchlistFiltering({
        ...dataset,
        columns: [
          {
            key: "watchlist_status",
            label: "Christianity_GSEC",
            sourceIndex: 0,
          },
          {
            key: "watchlist_frontier",
            label: "Christianity_Frontier_Group",
            sourceIndex: 1,
          },
        ],
      }),
    ).toBe(true);
  });

  it("reports watchlist filtering as unsupported when the column is absent", () => {
    expect(
      datasetSupportsWatchlistFiltering({
        ...dataset,
        columns: [
          {
            key: "geo_country_name",
            label: "Geo_Country_Name",
            sourceIndex: 0,
          },
          {
            key: "christianity_gsec",
            label: "Christianity_GSEC",
            sourceIndex: 1,
          },
        ],
      }),
    ).toBe(false);
  });

  it("builds the union of selected region countries", () => {
    const countries = getEnabledRegionCountryNames(
      [
        {
          id: "region-1",
          name: "South Asia",
          description: "",
          sortOrder: 1,
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-2",
          name: "EMENA",
          description: "",
          sortOrder: 2,
          countries: ["Turkey", "Jordan"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      {
        "region-1": true,
        "region-2": false,
      },
    );

    expect(countries).toEqual(["India", "Nepal"]);
  });

  it("treats no selector choices as all configured regions", () => {
    const countries = getEnabledRegionCountryNames(
      [
        {
          id: "region-1",
          name: "South Asia",
          description: "",
          sortOrder: 1,
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-2",
          name: "EMENA",
          description: "",
          sortOrder: 2,
          countries: ["Turkey", "Jordan"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      {
        "region-1": false,
        "region-2": false,
      },
    );

    expect(countries).toEqual(["India", "Nepal", "Turkey", "Jordan"]);
  });

  it("filters rows by enabled region countries", () => {
    const filteredRows = filterDatasetRowsByRegion(rows, {
      enabled: true,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames: ["Nepal"],
    });

    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]?.id).toBe("row-2");
  });

  it("still reads legacy row keys that use the raw header casing", () => {
    const filteredRows = filterDatasetRowsByRegion(
      [
        {
          id: "row-legacy",
          rowIndex: 0,
          data: {
            Geo_Country_Name: "India",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        hasConfiguredRegions: true,
        enabledCountryNames: ["India"],
      },
    );

    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]?.id).toBe("row-legacy");
  });

  it("keeps rows from all configured regions when no selectors are enabled", () => {
    const enabledCountryNames = getEnabledRegionCountryNames(
      [
        {
          id: "region-1",
          name: "South Asia",
          description: "",
          sortOrder: 1,
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      {
        "region-1": false,
      },
    );

    const filteredRows = filterDatasetRowsByRegion(rows, {
      enabled: true,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames,
    });

    expect(filteredRows).toHaveLength(2);
    expect(filteredRows.map((row) => row.id)).toEqual(["row-1", "row-2"]);
  });

  it("keeps all rows when region filtering is disabled", () => {
    const filteredRows = filterDatasetRowsByRegion(rows, {
      enabled: false,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames: ["India"],
    });

    expect(filteredRows).toHaveLength(3);
  });

  it("keeps only rows whose watchlist field is less than or equal to the threshold", () => {
    const filteredRows = filterDatasetRowsByWatchlist(rows, {
      enabled: true,
      isSupported: true,
      threshold: 2,
      frontierGroupRequired: true,
    });

    expect(filteredRows.map((row) => row.id)).toEqual(["row-1"]);
  });

  it("still reads legacy row keys that use the raw watchlist header casing", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-legacy",
          rowIndex: 0,
          data: {
            Christianity_GSEC: "1",
            Christianity_Frontier_Group: "TRUE",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        frontierGroupRequired: true,
      },
    );

    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]?.id).toBe("row-legacy");
  });

  it("excludes blank and non-numeric watchlist values when filtering is enabled", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-blank",
          rowIndex: 0,
          data: {
            christianity_gsec: "",
          },
        },
        {
          id: "row-nonnumeric",
          rowIndex: 1,
          data: {
            christianity_gsec: "unknown",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-match",
          rowIndex: 2,
          data: {
            christianity_gsec: "2",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-frontier-false",
          rowIndex: 3,
          data: {
            christianity_gsec: "1",
            christianity_frontier_group: "FALSE",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        frontierGroupRequired: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual(["row-match"]);
  });

  it("keeps all rows when watchlist filtering is disabled", () => {
    const filteredRows = filterDatasetRowsByWatchlist(rows, {
      enabled: false,
      isSupported: true,
      threshold: 2,
      frontierGroupRequired: true,
    });

    expect(filteredRows).toHaveLength(3);
  });

  it("keeps only rows whose UUPG field normalizes to false", () => {
    const filteredRows = filterDatasetRowsByUupg(
      [
        {
          id: "row-false-uppercase",
          rowIndex: 0,
          data: {
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-false-trimmed",
          rowIndex: 1,
          data: {
            Engage_Global_Engagement_Anywhere: " false ",
          },
        },
        {
          id: "row-true",
          rowIndex: 2,
          data: {
            engage_global_engagement_anywhere: "TRUE",
          },
        },
        {
          id: "row-blank",
          rowIndex: 3,
          data: {
            engage_global_engagement_anywhere: "",
          },
        },
        {
          id: "row-missing",
          rowIndex: 4,
          data: {},
        },
        {
          id: "row-other",
          rowIndex: 5,
          data: {
            engage_global_engagement_anywhere: "unknown",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-false-uppercase",
      "row-false-trimmed",
    ]);
  });

  it("keeps all rows when UUPG filtering is disabled", () => {
    const filteredRows = filterDatasetRowsByUupg(rows, {
      enabled: false,
      isSupported: true,
    });

    expect(filteredRows).toHaveLength(3);
  });

  it("applies region, watchlist, and UUPG filters with AND semantics", () => {
    const regionFilteredRows = filterDatasetRowsByRegion(
      [
        {
          id: "row-india-false",
          rowIndex: 0,
          data: {
            geo_country_name: "India",
            christianity_gsec: "2",
            christianity_frontier_group: "TRUE",
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-india-true",
          rowIndex: 1,
          data: {
            geo_country_name: "India",
            christianity_gsec: "2",
            christianity_frontier_group: "TRUE",
            engage_global_engagement_anywhere: "TRUE",
          },
        },
        {
          id: "row-nepal-false",
          rowIndex: 2,
          data: {
            geo_country_name: "Nepal",
            christianity_gsec: "2",
            christianity_frontier_group: "TRUE",
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-india-threshold-miss",
          rowIndex: 3,
          data: {
            geo_country_name: "India",
            christianity_gsec: "3",
            christianity_frontier_group: "TRUE",
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-india-frontier-false",
          rowIndex: 4,
          data: {
            geo_country_name: "India",
            christianity_gsec: "1",
            christianity_frontier_group: "FALSE",
            engage_global_engagement_anywhere: "FALSE",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        hasConfiguredRegions: true,
        enabledCountryNames: ["India"],
      },
    );
    const watchlistFilteredRows = filterDatasetRowsByWatchlist(regionFilteredRows, {
      enabled: true,
      isSupported: true,
      threshold: 2,
      frontierGroupRequired: true,
    });
    const filteredRows = filterDatasetRowsByUupg(watchlistFilteredRows, {
      enabled: true,
      isSupported: true,
    });

    expect(filteredRows.map((row) => row.id)).toEqual(["row-india-false"]);
  });
});
