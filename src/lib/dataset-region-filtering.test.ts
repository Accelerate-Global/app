import { describe, expect, it } from "vitest";

import type { DatasetRowsResponse, DatasetSummary } from "@/lib/api-types";
import { REGION_COUNTRY_OPTIONS } from "@/lib/region-country-options";
import {
  datasetSupportsCountryFiltering,
  datasetSupportsHotspotsFiltering,
  datasetSupportsRegionFiltering,
  datasetSupportsWatchlistJpOnlyFiltering,
  datasetSupportsWatchlistFiltering,
  datasetSupportsUupgFiltering,
  filterDatasetRowsByCountry,
  filterDatasetRowsByHotspots,
  filterDatasetRowsByRegion,
  filterDatasetRowsByWatchlist,
  filterDatasetRowsByUupg,
  getAvailableDatasetCountryNames,
  getEffectiveCountrySelection,
  getEnabledRegionCountryNames,
  getMatchingRegionIdsForCountries,
  getSelectedRegionCountryNames,
} from "./dataset-region-filtering";

function createJpOnlySourceFlags(
  overrides: Partial<
    Record<
      "JP_Source" | "IMB_Source" | "AX_Source" | "ETNO_Source" | "WCD_Source",
      string
    >
  > = {},
) {
  return {
    JP_Source: "TRUE",
    IMB_Source: "FALSE",
    AX_Source: "FALSE",
    ETNO_Source: "FALSE",
    WCD_Source: "FALSE",
    ...overrides,
  };
}

function createUupgFilter(
  overrides: Partial<{
    enabled: boolean;
    isSupported: boolean;
    globalEngagementAnywhereEnabled: boolean;
    frontierGroupEnabled: boolean;
    frontierGroupSupported: boolean;
  }> = {},
) {
  return {
    enabled: true,
    isSupported: true,
    globalEngagementAnywhereEnabled: true,
    frontierGroupEnabled: true,
    frontierGroupSupported: true,
    ...overrides,
  };
}

const rows: DatasetRowsResponse["rows"] = [
  {
    id: "row-1",
    rowIndex: 0,
    data: {
      geo_country_name: "India",
      alternate_countries: "Bhutan; Nepal",
      christianity_gsec: "2",
      engage_8_phases_of_engagement: "5",
      christianity_frontier_group: "TRUE",
      pg_population: "20000",
      percent_evangelical_pgac: "5",
      engage_global_engagement_anywhere: "FALSE",
      pg_peid: "PG-INDIA-1",
    },
  },
  {
    id: "row-2",
    rowIndex: 1,
    data: {
      geo_country_name: "Nepal",
      alternate_countries: "India ; Tibet",
      christianity_gsec: "3",
      engage_8_phases_of_engagement: "5",
      christianity_frontier_group: "TRUE",
      pg_population: "40000",
      percent_evangelical_pgac: "5",
      engage_global_engagement_anywhere: "TRUE",
      pg_peid: "PG-NEPAL-1",
    },
  },
  {
    id: "row-3",
    rowIndex: 2,
    data: {
      Geo_Country_Name: "",
      Christianity_GSEC: "",
      Engage_8_Phases_of_Engagement: "",
      Christianity_Frontier_Group: "",
      PG_Population: "",
      Percent_Evangelical_PGAC: "",
      Engage_Global_Engagement_Anywhere: "",
      PG_PEID: "",
    },
  },
];

const dataset = {
  id: "dataset-1",
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "Global",
  blobUrl: "https://example.com/dataset.csv",
  blobPath: "datasets/global.csv",
  isPrimary: true,
  isPublic: true,
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
      key: "alternate_countries",
      label: "Alternate Countries",
      sourceIndex: 2,
    },
    {
      key: "christianity_frontier_group",
      label: "Christianity_Frontier_Group",
      sourceIndex: 3,
    },
    {
      key: "engage_8_phases_of_engagement",
      label: "Engage_8_Phases_of_Engagement",
      sourceIndex: 4,
    },
    {
      key: "pg_population",
      label: "PG_Population",
      sourceIndex: 5,
    },
    {
      key: "percent_evangelical_pgac",
      label: "Percent_Evangelical_PGAC",
      sourceIndex: 6,
    },
    {
      key: "pg_peid",
      label: "PG_PEID",
      sourceIndex: 8,
    },
    {
      key: "engage_global_engagement_anywhere",
      label: "Engage_Global_Engagement_Anywhere",
      sourceIndex: 9,
    },
  ],
  hiddenColumnKeys: [],
  defaultFilters: null,
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies DatasetSummary;

describe("dataset-region-filtering", () => {
  it("detects support when the dataset stores normalized column keys", () => {
    expect(datasetSupportsRegionFiltering(dataset)).toBe(true);
  });

  it("detects country support when the dataset stores normalized column keys", () => {
    expect(datasetSupportsCountryFiltering(dataset)).toBe(true);
  });

  it("detects UUPG support when the dataset stores normalized column keys", () => {
    expect(datasetSupportsUupgFiltering(dataset)).toBe(true);
  });

  it("detects watchlist support when the dataset stores normalized column keys", () => {
    expect(datasetSupportsWatchlistFiltering(dataset)).toBe(true);
  });

  it("detects JP-only watchlist support when the dataset includes the source flags", () => {
    expect(
      datasetSupportsWatchlistJpOnlyFiltering({
        ...dataset,
        columns: [
          ...dataset.columns,
          { key: "jp_source", label: "JP_Source", sourceIndex: 10 },
          { key: "imb_source", label: "IMB_Source", sourceIndex: 11 },
          { key: "ax_source", label: "AX_Source", sourceIndex: 12 },
          { key: "etno_source", label: "ETNO_Source", sourceIndex: 13 },
          { key: "wcd_source", label: "WCD_Source", sourceIndex: 14 },
        ],
      }),
    ).toBe(true);
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

  it("detects Hotspots support when the dataset stores normalized column keys", () => {
    expect(datasetSupportsHotspotsFiltering(dataset)).toBe(true);
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

  it("reports Hotspots filtering as unsupported when a required column is absent", () => {
    expect(
      datasetSupportsHotspotsFiltering({
        ...dataset,
        columns: dataset.columns.filter((column) => column.key !== "pg_peid"),
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
            key: "watchlist_engagement_phase",
            label: "Engage_8_Phases_of_Engagement",
            sourceIndex: 1,
          },
          {
            key: "watchlist_population",
            label: "PG_Population",
            sourceIndex: 2,
          },
          {
            key: "watchlist_percent_evangelical",
            label: "Percent_Evangelical_PGAC",
            sourceIndex: 3,
          },
        ],
      }),
    ).toBe(true);
  });

  it("detects watchlist support when the frontier field is absent", () => {
    expect(
      datasetSupportsWatchlistFiltering({
        ...dataset,
        columns: [
          {
            key: "christianity_gsec",
            label: "Christianity_GSEC",
            sourceIndex: 0,
          },
          {
            key: "engage_8_phases_of_engagement",
            label: "Engage_8_Phases_of_Engagement",
            sourceIndex: 1,
          },
          {
            key: "pg_population",
            label: "PG_Population",
            sourceIndex: 2,
          },
          {
            key: "percent_evangelical_pgac",
            label: "Percent_Evangelical_PGAC",
            sourceIndex: 3,
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

  it("reports JP-only watchlist filtering as unsupported when a source flag is absent", () => {
    expect(
      datasetSupportsWatchlistJpOnlyFiltering({
        ...dataset,
        columns: [
          ...dataset.columns,
          { key: "jp_source", label: "JP_Source", sourceIndex: 10 },
          { key: "imb_source", label: "IMB_Source", sourceIndex: 11 },
          { key: "ax_source", label: "AX_Source", sourceIndex: 12 },
          { key: "etno_source", label: "ETNO_Source", sourceIndex: 13 },
        ],
      }),
    ).toBe(false);
  });

  it("builds the union of selected region countries", () => {
    const countries = getEnabledRegionCountryNames(
      [
        {
          id: "region-1",
          name: "Asia, South",
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
          name: "Asia, South",
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

  it("builds only the exact union of currently selected region countries", () => {
    const countries = getSelectedRegionCountryNames(
      [
        {
          id: "region-global",
          name: "Global",
          description: "",
          sortOrder: 1,
          countries: ["India", "Nepal", "Brazil"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-south-asia",
          name: "Asia, South",
          description: "",
          sortOrder: 2,
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      {
        "region-global": false,
        "region-south-asia": true,
      },
    );

    expect(countries).toEqual(["India", "Nepal"]);
  });

  it("matches Global only when the selected countries exactly equal Global", () => {
    const matchedRegionIds = getMatchingRegionIdsForCountries(
      [
        {
          id: "region-global",
          name: "Global",
          description: "",
          sortOrder: 1,
          countries: ["India", "Nepal", "Brazil"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-south-asia",
          name: "Asia, South",
          description: "",
          sortOrder: 2,
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      ["India", "Nepal", "Brazil"],
      ["India", "Nepal", "Brazil"],
    );

    expect(matchedRegionIds).toEqual(["region-global"]);
  });

  it("matches Global when the selected countries equal the dataset-relative Global subset", () => {
    const datasetCountryNames = REGION_COUNTRY_OPTIONS.slice(0, 222);
    const matchedRegionIds = getMatchingRegionIdsForCountries(
      [
        {
          id: "region-global",
          name: "Global",
          description: "",
          sortOrder: 1,
          countries: [...REGION_COUNTRY_OPTIONS],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      datasetCountryNames,
      datasetCountryNames,
    );

    expect(matchedRegionIds).toEqual(["region-global"]);
  });

  it("matches the smallest exact non-global region combination when no single region fits", () => {
    const matchedRegionIds = getMatchingRegionIdsForCountries(
      [
        {
          id: "region-global",
          name: "Global",
          description: "",
          sortOrder: 1,
          countries: ["India", "Nepal", "Brazil", "Peru", "Mexico"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-south-asia",
          name: "Asia, South",
          description: "",
          sortOrder: 2,
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-latin-america",
          name: "America, Latin",
          description: "",
          sortOrder: 3,
          countries: ["Brazil", "Peru"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-india",
          name: "India only",
          description: "",
          sortOrder: 4,
          countries: ["India"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      ["India", "Nepal", "Brazil", "Peru"],
      ["India", "Nepal", "Brazil", "Peru", "Mexico"],
    );

    expect(matchedRegionIds).toEqual([
      "region-south-asia",
      "region-latin-america",
    ]);
  });

  it("returns no region match when the selected countries no longer match a configured region", () => {
    const matchedRegionIds = getMatchingRegionIdsForCountries(
      [
        {
          id: "region-global",
          name: "Global",
          description: "",
          sortOrder: 1,
          countries: ["India", "Nepal", "Brazil"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "region-south-asia",
          name: "Asia, South",
          description: "",
          sortOrder: 2,
          countries: ["India", "Nepal"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      ["India"],
      ["India", "Nepal", "Brazil"],
    );

    expect(matchedRegionIds).toEqual([]);
  });

  it("treats all visible countries as selected when there is no explicit country subset", () => {
    const selection = getEffectiveCountrySelection({
      availableCountryNames: ["Brazil", "India", "Nepal"],
      countryFilterEnabled: false,
      regionFilterEnabled: true,
      regionCountryNames: ["India", "Nepal"],
      selectedCountryNames: ["India", "Nepal"],
    });

    expect(selection).toEqual({
      selectedCountryNames: ["India", "Nepal"],
      hasExplicitSelection: false,
    });
  });

  it("keeps only the explicit visible country subset when country filtering is active", () => {
    const selection = getEffectiveCountrySelection({
      availableCountryNames: ["Brazil", "India", "Nepal"],
      countryFilterEnabled: true,
      regionFilterEnabled: true,
      regionCountryNames: ["India", "Nepal"],
      selectedCountryNames: ["India"],
    });

    expect(selection).toEqual({
      selectedCountryNames: ["India"],
      hasExplicitSelection: true,
    });
  });

  it("preserves an explicit empty country selection when country filtering is active", () => {
    const selection = getEffectiveCountrySelection({
      availableCountryNames: ["Brazil", "India", "Nepal"],
      countryFilterEnabled: true,
      regionFilterEnabled: false,
      regionCountryNames: [],
      selectedCountryNames: [],
    });

    expect(selection).toEqual({
      selectedCountryNames: [],
      hasExplicitSelection: true,
    });
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

  it("builds country options from primary country fields by default", () => {
    expect(getAvailableDatasetCountryNames(rows)).toEqual([
      "India",
      "Nepal",
    ]);
  });

  it("includes alternate-country fields in the option list when enabled", () => {
    expect(
      getAvailableDatasetCountryNames(rows, {
        includeAlternateCountries: true,
      }),
    ).toEqual([
      "Bhutan",
      "India",
      "Nepal",
      "Tibet",
    ]);
  });

  it("filters rows by primary country matches when alternate-country matching is off", () => {
    const filteredRows = filterDatasetRowsByCountry(rows, {
      enabled: true,
      isSupported: true,
      selectedCountryNames: ["Bhutan"],
      includeAlternateCountries: false,
    });

    expect(filteredRows).toEqual([]);
  });

  it("filters rows by primary or alternate country matches when enabled", () => {
    const filteredRows = filterDatasetRowsByCountry(rows, {
      enabled: true,
      isSupported: true,
      selectedCountryNames: ["Bhutan"],
      includeAlternateCountries: true,
    });

    expect(filteredRows.map((row) => row.id)).toEqual(["row-1"]);
  });

  it("returns no rows when country filtering is enabled without selected countries", () => {
    const filteredRows = filterDatasetRowsByCountry(rows, {
      enabled: true,
      isSupported: true,
      selectedCountryNames: [],
      includeAlternateCountries: false,
    });

    expect(filteredRows).toEqual([]);
  });

  it("combines region and country filters as an intersection", () => {
    const regionFilteredRows = filterDatasetRowsByRegion(rows, {
      enabled: true,
      isSupported: true,
      hasConfiguredRegions: true,
      enabledCountryNames: ["India"],
    });
    const countryFilteredRows = filterDatasetRowsByCountry(regionFilteredRows, {
      enabled: true,
      isSupported: true,
      selectedCountryNames: ["Tibet"],
      includeAlternateCountries: true,
    });

    expect(countryFilteredRows).toEqual([]);
  });

  it("ranks hotspot countries by unique UUPGs and returns only UUPG rows", () => {
    const filteredRows = filterDatasetRowsByHotspots(
      [
        {
          id: "row-1",
          rowIndex: 0,
          data: {
            geo_country_name: "India",
            pg_peid: "PG-INDIA-1",
            pg_population: "100",
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-2",
          rowIndex: 1,
          data: {
            geo_country_name: "India",
            pg_peid: "PG-INDIA-2",
            pg_population: "250",
            engage_global_engagement_anywhere: "",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-3",
          rowIndex: 2,
          data: {
            geo_country_name: "Nepal",
            pg_peid: "PG-NEPAL-1",
            pg_population: "500",
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-4",
          rowIndex: 3,
          data: {
            geo_country_name: "India",
            pg_peid: "PG-INDIA-3",
            pg_population: "999",
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "FALSE",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        metric: "unique_uupgs",
        countryCount: 1,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual(["row-1", "row-2"]);
  });

  it("ranks hotspot countries by UUPG population with country-name tie-breaking", () => {
    const filteredRows = filterDatasetRowsByHotspots(
      [
        {
          id: "row-brazil",
          rowIndex: 0,
          data: {
            geo_country_name: "Brazil",
            pg_peid: "PG-BRAZIL-1",
            pg_population: "300",
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-india",
          rowIndex: 1,
          data: {
            geo_country_name: "India",
            pg_peid: "PG-INDIA-1",
            pg_population: "300",
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "TRUE",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        metric: "population",
        countryCount: 1,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual(["row-brazil"]);
  });

  it("keeps hotspots aligned with the composite UUPG rule", () => {
    const filteredRows = filterDatasetRowsByHotspots(
      [
        {
          id: "row-india-match",
          rowIndex: 0,
          data: {
            geo_country_name: "India",
            pg_peid: "PG-INDIA-1",
            pg_population: "100",
            engage_global_engagement_anywhere: "FALSE",
            frontier_group: "TRUE",
          },
        },
        {
          id: "row-india-blank-gea",
          rowIndex: 1,
          data: {
            geo_country_name: "India",
            pg_peid: "PG-INDIA-2",
            pg_population: "200",
            engage_global_engagement_anywhere: "",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-nepal-frontier-false",
          rowIndex: 2,
          data: {
            geo_country_name: "Nepal",
            pg_peid: "PG-NEPAL-1",
            pg_population: "300",
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "FALSE",
          },
        },
        {
          id: "row-nepal-gea-true",
          rowIndex: 3,
          data: {
            geo_country_name: "Nepal",
            pg_peid: "PG-NEPAL-2",
            pg_population: "400",
            engage_global_engagement_anywhere: "TRUE",
            christianity_frontier_group: "TRUE",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        metric: "unique_uupgs",
        countryCount: 1,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-india-match",
      "row-india-blank-gea",
    ]);
  });

  it("lets hotspots follow the active split UUPG criteria even when the UUPG master toggle is off", () => {
    const filteredRows = filterDatasetRowsByHotspots(
      [
        {
          id: "row-brazil-frontier-only",
          rowIndex: 0,
          data: {
            geo_country_name: "Brazil",
            pg_peid: "PG-BRAZIL-1",
            pg_population: "500",
            engage_global_engagement_anywhere: "TRUE",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-india-frontier-false",
          rowIndex: 1,
          data: {
            geo_country_name: "India",
            pg_peid: "PG-INDIA-1",
            pg_population: "600",
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "FALSE",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        metric: "population",
        countryCount: 1,
      },
      createUupgFilter({
        enabled: false,
        globalEngagementAnywhereEnabled: false,
        frontierGroupEnabled: true,
      }),
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-brazil-frontier-only",
    ]);
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

  it("supports mixed normalized and raw country keys for options and alternate-country matches", () => {
    const mixedRows: DatasetRowsResponse["rows"] = [
      {
        id: "row-mixed-country-1",
        rowIndex: 0,
        data: {
          Geo_Country_Name: "India",
          alternate_countries: "Bhutan; Nepal",
        },
      },
      {
        id: "row-mixed-country-2",
        rowIndex: 1,
        data: {
          geo_country_name: "Brazil",
          Alternate_Countries: "Argentina",
        },
      },
    ];

    expect(
      getAvailableDatasetCountryNames(mixedRows, {
        includeAlternateCountries: true,
      }),
    ).toEqual(["Argentina", "Bhutan", "Brazil", "India", "Nepal"]);

    const filteredRows = filterDatasetRowsByCountry(mixedRows, {
      enabled: true,
      isSupported: true,
      selectedCountryNames: ["Argentina", "Nepal"],
      includeAlternateCountries: true,
    });

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-mixed-country-1",
      "row-mixed-country-2",
    ]);
  });

  it("keeps rows from all configured regions when no selectors are enabled", () => {
    const enabledCountryNames = getEnabledRegionCountryNames(
      [
        {
          id: "region-1",
          name: "Asia, South",
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
      engagementPhaseThreshold: 6,
      evangelicalBelieversThreshold: 1000,
      evangelicalPercentThreshold: 0.05,
      frontierGroupValue: true,
    });

    expect(filteredRows.map((row) => row.id)).toEqual(["row-1"]);
  });

  it("skips the engagement phase rule when that toggle is disabled", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-phase-one",
          rowIndex: 0,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "1",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-phase-five",
          rowIndex: 1,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseEnabled: false,
        engagementPhaseThreshold: 2,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-phase-one",
      "row-phase-five",
    ]);
  });

  it("applies a custom engagement-phase rule when configured", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-phase-one",
          rowIndex: 0,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "1",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
            ax_source: "true",
          },
        },
        {
          id: "row-phase-four",
          rowIndex: 1,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "4",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
            ax_source: "true",
          },
        },
        {
          id: "row-phase-five",
          rowIndex: 2,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
            ax_source: "true",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseEnabled: true,
        engagementPhaseThreshold: 4,
        engagementPhaseRule: {
          minPhase: 1,
          maxPhase: 4,
        },
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-phase-one",
      "row-phase-four",
    ]);
  });

  it("applies the JP-only evangelical rule at the inclusive boundaries", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-min",
          rowIndex: 0,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "1",
            pg_population: "3750",
            percent_evangelical_pgac: "2",
            ...createJpOnlySourceFlags(),
          },
        },
        {
          id: "row-max",
          rowIndex: 1,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "7",
            pg_population: "12499950",
            percent_evangelical_pgac: "2",
            ...createJpOnlySourceFlags(),
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        jpOnlyEvangelicalCriteriaEnabled: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual(["row-min", "row-max"]);
  });

  it("applies a custom JP-only evangelical rule when configured", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-custom-below-min",
          rowIndex: 0,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "7",
            pg_population: "4450",
            percent_evangelical_pgac: "2",
            ...createJpOnlySourceFlags(),
          },
        },
        {
          id: "row-custom-in-range",
          rowIndex: 1,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "7",
            pg_population: "10000",
            percent_evangelical_pgac: "2.5",
            ...createJpOnlySourceFlags(),
          },
        },
        {
          id: "row-custom-percent-miss",
          rowIndex: 2,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "7",
            pg_population: "10000",
            percent_evangelical_pgac: "2.51",
            ...createJpOnlySourceFlags(),
          },
        },
        {
          id: "row-custom-above-max",
          rowIndex: 3,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "7",
            pg_population: "12400000",
            percent_evangelical_pgac: "2.5",
            ...createJpOnlySourceFlags(),
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        jpOnlyEvangelicalCriteriaEnabled: true,
        jpOnlyEvangelicalRule: {
          minBelievers: 90,
          maxBelievers: 300_000,
          maxPercentEvangelical: 2.5,
        },
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-custom-below-min",
      "row-custom-in-range",
    ]);
  });

  it("keeps JP-only rows under 75 believers regardless of percent, while rejecting the remaining misses", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-below-min",
          rowIndex: 0,
          data: {
            christianity_gsec: "1",
            engage_8_phases_of_engagement: "5",
            pg_population: "3700",
            percent_evangelical_pgac: "2",
            ...createJpOnlySourceFlags(),
          },
        },
        {
          id: "row-above-max",
          rowIndex: 1,
          data: {
            christianity_gsec: "1",
            engage_8_phases_of_engagement: "5",
            pg_population: "12500000",
            percent_evangelical_pgac: "2",
            ...createJpOnlySourceFlags(),
          },
        },
        {
          id: "row-percent-miss",
          rowIndex: 2,
          data: {
            christianity_gsec: "1",
            engage_8_phases_of_engagement: "5",
            pg_population: "10000",
            percent_evangelical_pgac: "2.01",
            ...createJpOnlySourceFlags(),
          },
        },
        {
          id: "row-under-min-percent-agnostic",
          rowIndex: 3,
          data: {
            christianity_gsec: "1",
            engage_8_phases_of_engagement: "5",
            pg_population: "1000",
            percent_evangelical_pgac: "7.4",
            ...createJpOnlySourceFlags(),
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        jpOnlyEvangelicalCriteriaEnabled: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-below-min",
      "row-under-min-percent-agnostic",
    ]);
  });

  it("lets the JP-only rule replace the GSEC and engagement-phase gates", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-jp-only-match",
          rowIndex: 0,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "",
            pg_population: "10000",
            percent_evangelical_pgac: "1",
            ...createJpOnlySourceFlags(),
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        jpOnlyEvangelicalCriteriaEnabled: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual(["row-jp-only-match"]);
  });

  it("keeps the existing GSEC and engagement behavior for non-JP-only rows", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-non-jp-only",
          rowIndex: 0,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "",
            pg_population: "10000",
            percent_evangelical_pgac: "1",
            ...createJpOnlySourceFlags({ IMB_Source: "TRUE" }),
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        jpOnlyEvangelicalCriteriaEnabled: true,
      },
    );

    expect(filteredRows).toHaveLength(0);
  });

  it("does not classify rows as JP-only when a source flag is missing or invalid", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-missing-flag",
          rowIndex: 0,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "",
            pg_population: "10000",
            percent_evangelical_pgac: "1",
            ...createJpOnlySourceFlags({
              WCD_Source: "",
            }),
          },
        },
        {
          id: "row-invalid-flag",
          rowIndex: 1,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "",
            pg_population: "10000",
            percent_evangelical_pgac: "1",
            ...createJpOnlySourceFlags({
              AX_Source: "UNKNOWN",
            }),
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        jpOnlyEvangelicalCriteriaEnabled: true,
      },
    );

    expect(filteredRows).toHaveLength(0);
  });

  it("falls back to the existing watchlist gates when the JP-only rule is disabled", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-jp-only-disabled",
          rowIndex: 0,
          data: {
            christianity_gsec: "6",
            engage_8_phases_of_engagement: "",
            pg_population: "10000",
            percent_evangelical_pgac: "1",
            ...createJpOnlySourceFlags(),
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        jpOnlyEvangelicalCriteriaEnabled: false,
      },
    );

    expect(filteredRows).toHaveLength(0);
  });

  it("still reads legacy row keys that use the raw watchlist header casing", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-legacy",
          rowIndex: 0,
          data: {
            Christianity_GSEC: "1",
            Engage_8_Phases_of_Engagement: "5",
            Christianity_Frontier_Group: "TRUE",
            PG_Population: "10000",
            Percent_Evangelical_PGAC: "5",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversEnabled: false,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentEnabled: false,
        evangelicalPercentThreshold: 0.05,
        frontierGroupValue: true,
      },
    );

    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]?.id).toBe("row-legacy");
  });

  it("supports mixed normalized and raw watchlist keys while honoring frontier aliases", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-watchlist-mixed-match",
          rowIndex: 0,
          data: {
            Christianity_GSEC: "2",
            engage_8_phases_of_engagement: "5",
            frontier_group: "TRUE",
            PG_Population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-watchlist-mixed-miss",
          rowIndex: 1,
          data: {
            Christianity_GSEC: "3",
            engage_8_phases_of_engagement: "5",
            frontier_group: "TRUE",
            PG_Population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversEnabled: false,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentEnabled: false,
        evangelicalPercentThreshold: 0.05,
        frontierGroupValue: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-watchlist-mixed-match",
    ]);
  });

  it("keeps blank or missing watchlist values while still excluding invalid or above-threshold values", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-blank",
          rowIndex: 0,
          data: {
            christianity_gsec: "",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-missing",
          rowIndex: 1,
          data: {
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-nonnumeric",
          rowIndex: 2,
          data: {
            christianity_gsec: "unknown",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-match",
          rowIndex: 3,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-threshold-miss",
          rowIndex: 4,
          data: {
            christianity_gsec: "3",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-frontier-false",
          rowIndex: 5,
          data: {
            christianity_gsec: "1",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "FALSE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversEnabled: false,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentEnabled: false,
        evangelicalPercentThreshold: 0.05,
        frontierGroupValue: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-blank",
      "row-missing",
      "row-match",
      "row-frontier-false",
    ]);
  });

  it("ignores frontier group values when filtering watchlist rows", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-true",
          rowIndex: 0,
          data: {
            christianity_gsec: "1",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-false",
          rowIndex: 1,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "FALSE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-false-threshold-miss",
          rowIndex: 2,
          data: {
            christianity_gsec: "3",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "FALSE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversEnabled: false,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentEnabled: false,
        evangelicalPercentThreshold: 0.05,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual(["row-true", "row-false"]);
  });

  it("ignores frontier alias values when filtering watchlist rows", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-alias-true",
          rowIndex: 0,
          data: {
            christianity_gsec: "1",
            engage_8_phases_of_engagement: "5",
            frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
        {
          id: "row-alias-false",
          rowIndex: 1,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            frontier_group: "FALSE",
            pg_population: "10000",
            percent_evangelical_pgac: "5",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversEnabled: false,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentEnabled: false,
        evangelicalPercentThreshold: 0.05,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-alias-true",
      "row-alias-false",
    ]);
  });

  it("keeps only rows whose evangelical believers count meets the minimum threshold", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-match",
          rowIndex: 0,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "20",
          },
        },
        {
          id: "row-miss",
          rowIndex: 1,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversThreshold: 1500,
        evangelicalPercentEnabled: false,
        evangelicalPercentThreshold: 0.05,
        frontierGroupValue: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual(["row-match"]);
  });

  it("keeps only rows whose evangelical percent is greater than or equal to the threshold", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-match",
          rowIndex: 0,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "50000",
            percent_evangelical_pgac: "0.05",
          },
        },
        {
          id: "row-miss",
          rowIndex: 1,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "50000",
            percent_evangelical_pgac: "0.04",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversEnabled: false,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentThreshold: 0.05,
        frontierGroupValue: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual(["row-match"]);
  });

  it("keeps only AX rows whose engagement phase is within the hardcoded 2-5 range", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-phase-2",
          rowIndex: 0,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "2",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
            AX_Source: "TRUE",
          },
        },
        {
          id: "row-phase-5",
          rowIndex: 1,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
            AX_Source: "TRUE",
          },
        },
        {
          id: "row-phase-1",
          rowIndex: 2,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "1",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
            AX_Source: "TRUE",
          },
        },
        {
          id: "row-phase-6",
          rowIndex: 3,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "6",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
            AX_Source: "TRUE",
          },
        },
        {
          id: "row-phase-missing",
          rowIndex: 4,
          data: {
            christianity_gsec: "2",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
            AX_Source: "TRUE",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversEnabled: false,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentEnabled: false,
        evangelicalPercentThreshold: 0.05,
        frontierGroupValue: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-phase-2",
      "row-phase-5",
    ]);
  });

  it("skips the engagement phase gate for rows that are explicitly non-AX", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-non-ax-phase-1",
          rowIndex: 0,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "1",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
            AX_Source: "FALSE",
          },
        },
        {
          id: "row-non-ax-phase-missing",
          rowIndex: 1,
          data: {
            christianity_gsec: "2",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
            AX_Source: "FALSE",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversEnabled: false,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentEnabled: false,
        evangelicalPercentThreshold: 0.05,
        frontierGroupValue: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-non-ax-phase-1",
      "row-non-ax-phase-missing",
    ]);
  });

  it("treats rows with missing or invalid AX source flags as AX for engagement phases", () => {
    const filteredRows = filterDatasetRowsByWatchlist(
      [
        {
          id: "row-missing-ax-in-range",
          rowIndex: 0,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "4",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
          },
        },
        {
          id: "row-missing-ax-out-of-range",
          rowIndex: 1,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "1",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
          },
        },
        {
          id: "row-invalid-ax-in-range",
          rowIndex: 2,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
            AX_Source: "UNKNOWN",
          },
        },
        {
          id: "row-invalid-ax-out-of-range",
          rowIndex: 3,
          data: {
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "6",
            christianity_frontier_group: "TRUE",
            pg_population: "10000",
            percent_evangelical_pgac: "10",
            AX_Source: "UNKNOWN",
          },
        },
      ],
      {
        enabled: true,
        isSupported: true,
        threshold: 2,
        engagementPhaseThreshold: 6,
        evangelicalBelieversEnabled: false,
        evangelicalBelieversThreshold: 1000,
        evangelicalPercentEnabled: false,
        evangelicalPercentThreshold: 0.05,
        frontierGroupValue: true,
      },
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-missing-ax-in-range",
      "row-invalid-ax-in-range",
    ]);
  });

  it("keeps all rows when watchlist filtering is disabled", () => {
    const filteredRows = filterDatasetRowsByWatchlist(rows, {
      enabled: false,
      isSupported: true,
      threshold: 2,
      engagementPhaseThreshold: 6,
      evangelicalBelieversThreshold: 1000,
      evangelicalPercentThreshold: 0.05,
      frontierGroupValue: true,
    });

    expect(filteredRows).toHaveLength(3);
  });

  it("keeps rows when UUPG values match the composite null-preserving rule", () => {
    const filteredRows = filterDatasetRowsByUupg(
      [
        {
          id: "row-false-uppercase",
          rowIndex: 0,
          data: {
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-false-trimmed",
          rowIndex: 1,
          data: {
            Engage_Global_Engagement_Anywhere: " false ",
            frontier_group: " true ",
          },
        },
        {
          id: "row-blank-gea",
          rowIndex: 2,
          data: {
            engage_global_engagement_anywhere: "",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-missing-gea",
          rowIndex: 3,
          data: {
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-blank-frontier",
          rowIndex: 4,
          data: {
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "",
          },
        },
        {
          id: "row-missing-frontier",
          rowIndex: 5,
          data: {
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-true",
          rowIndex: 6,
          data: {
            engage_global_engagement_anywhere: "TRUE",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-frontier-false",
          rowIndex: 7,
          data: {
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "FALSE",
          },
        },
        {
          id: "row-frontier-other",
          rowIndex: 8,
          data: {
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "unknown",
          },
        },
        {
          id: "row-other",
          rowIndex: 9,
          data: {
            engage_global_engagement_anywhere: "unknown",
            christianity_frontier_group: "TRUE",
          },
        },
      ],
      createUupgFilter(),
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-false-uppercase",
      "row-false-trimmed",
      "row-blank-gea",
      "row-missing-gea",
      "row-blank-frontier",
      "row-missing-frontier",
    ]);
  });

  it("supports mixed normalized and raw UUPG and frontier keys in the same batch", () => {
    const filteredRows = filterDatasetRowsByUupg(
      [
        {
          id: "row-uupg-mixed-match",
          rowIndex: 0,
          data: {
            Engage_Global_Engagement_Anywhere: "FALSE",
            frontier_group: "TRUE",
          },
        },
        {
          id: "row-uupg-frontier-mixed-match",
          rowIndex: 1,
          data: {
            engage_global_engagement_anywhere: "FALSE",
            Christianity_Frontier_Group: "TRUE",
          },
        },
        {
          id: "row-uupg-mixed-miss",
          rowIndex: 2,
          data: {
            engage_global_engagement_anywhere: "TRUE",
            christianity_frontier_group: "TRUE",
          },
        },
        {
          id: "row-frontier-mixed-miss",
          rowIndex: 3,
          data: {
            Engage_Global_Engagement_Anywhere: "FALSE",
            frontier_group: "FALSE",
          },
        },
      ],
      createUupgFilter(),
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-uupg-mixed-match",
      "row-uupg-frontier-mixed-match",
    ]);
  });

  it("applies only the enabled split UUPG criteria", () => {
    const filteredRows = filterDatasetRowsByUupg(
      [
        {
          id: "row-gea-match-frontier-false",
          rowIndex: 0,
          data: {
            engage_global_engagement_anywhere: "FALSE",
            christianity_frontier_group: "FALSE",
          },
        },
        {
          id: "row-gea-miss-frontier-true",
          rowIndex: 1,
          data: {
            engage_global_engagement_anywhere: "TRUE",
            christianity_frontier_group: "TRUE",
          },
        },
      ],
      createUupgFilter({
        frontierGroupEnabled: false,
      }),
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-gea-match-frontier-false",
    ]);
  });

  it("keeps all rows when UUPG filtering is disabled", () => {
    const filteredRows = filterDatasetRowsByUupg(
      rows,
      createUupgFilter({ enabled: false }),
    );

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
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-india-true",
          rowIndex: 1,
          data: {
            geo_country_name: "India",
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
            engage_global_engagement_anywhere: "TRUE",
          },
        },
        {
          id: "row-india-blank-gea",
          rowIndex: 2,
          data: {
            geo_country_name: "India",
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
            engage_global_engagement_anywhere: "",
          },
        },
        {
          id: "row-nepal-false",
          rowIndex: 3,
          data: {
            geo_country_name: "Nepal",
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-india-threshold-miss",
          rowIndex: 4,
          data: {
            geo_country_name: "India",
            christianity_gsec: "3",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-india-frontier-false",
          rowIndex: 5,
          data: {
            geo_country_name: "India",
            christianity_gsec: "1",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "FALSE",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-india-evangelical-believers-miss",
          rowIndex: 6,
          data: {
            geo_country_name: "India",
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "5",
            christianity_frontier_group: "TRUE",
            pg_population: "50000",
            percent_evangelical_pgac: "1",
            engage_global_engagement_anywhere: "FALSE",
          },
        },
        {
          id: "row-india-engagement-phase-miss",
          rowIndex: 7,
          data: {
            geo_country_name: "India",
            christianity_gsec: "2",
            engage_8_phases_of_engagement: "6",
            christianity_frontier_group: "TRUE",
            pg_population: "20000",
            percent_evangelical_pgac: "5",
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
      engagementPhaseThreshold: 6,
      evangelicalBelieversThreshold: 1000,
      evangelicalPercentThreshold: 0.05,
      frontierGroupValue: true,
    });
    const filteredRows = filterDatasetRowsByUupg(
      watchlistFilteredRows,
      createUupgFilter(),
    );

    expect(filteredRows.map((row) => row.id)).toEqual([
      "row-india-false",
      "row-india-blank-gea",
    ]);
  });
});
