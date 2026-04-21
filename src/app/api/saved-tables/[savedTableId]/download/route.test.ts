import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getAllDatasetRows, getDataset } from "@/lib/datasets";
import { listFieldDefinitionPresentationByColumnKey } from "@/lib/field-definitions";
import { getSavedDatasetTable } from "@/lib/saved-dataset-tables";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/datasets", () => ({
  getAllDatasetRows: vi.fn(),
  getDataset: vi.fn(),
}));

vi.mock("@/lib/field-definitions", () => ({
  listFieldDefinitionPresentationByColumnKey: vi.fn(),
}));

vi.mock("@/lib/saved-dataset-tables", () => ({
  getSavedDatasetTable: vi.fn(),
}));

const getAllDatasetRowsMock = vi.mocked(getAllDatasetRows);
const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getDatasetMock = vi.mocked(getDataset);
const getSavedDatasetTableMock = vi.mocked(getSavedDatasetTable);
const listFieldDefinitionPresentationByColumnKeyMock = vi.mocked(
  listFieldDefinitionPresentationByColumnKey,
);

const identity = {
  ownerId: "supabase-user",
  email: "viewer@example.com",
  fullName: null,
  isDatasetAdmin: false,
  mode: "supabase" as const,
};

const context = {
  params: Promise.resolve({
    savedTableId: "c0000000-0000-4000-8000-000000000001",
  }),
};

const dataset = {
  id: "f0000000-0000-4000-8000-000000000001",
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "Every People Group.csv",
  blobUrl: "https://example.com/every-people-group.csv",
  blobPath: "datasets/every-people-group.csv",
  isPrimary: true,
  status: "ready" as const,
  rowCount: 3,
  sizeBytes: 100,
  columns: [
    {
      key: "pg_rop3",
      label: "ROP3",
      sourceIndex: 0,
    },
    {
      key: "geo_country_name",
      label: "Country",
      sourceIndex: 1,
    },
  ],
  hiddenColumnKeys: [],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const savedTable = {
  id: "c0000000-0000-4000-8000-000000000001",
  datasetId: dataset.id,
  datasetFileName: dataset.fileName,
  name: "North Africa focus",
  details: "",
  filters: {
    region: {
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000001"],
      selectedRegionNames: ["North Africa"],
      enabledCountryNames: ["Egypt"],
    },
    country: {
      enabled: false,
      selectedCountryNames: [],
      includeAlternateCountries: false,
    },
    watchlist: {
      enabled: false,
      threshold: 2,
      engagementPhaseThreshold: 6,
      evangelicalBelieversThreshold: 1000,
      evangelicalPercentThreshold: 0.05,
      frontierGroupValue: true,
    },
    uupg: {
      enabled: false,
    },
    sorting: [
      {
        id: "pg_rop3",
        desc: true,
      },
    ],
  },
  savedRowCount: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/saved-tables/[savedTableId]/download", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
    getSavedDatasetTableMock.mockResolvedValue(savedTable);
    getDatasetMock.mockResolvedValue(dataset);
    getAllDatasetRowsMock.mockResolvedValue({
      sourceDatasetId: dataset.id,
      rows: [
        {
          id: "row-1",
          rowIndex: 0,
          data: {
            pg_rop3: "100011.0",
            geo_country_name: "Egypt",
            alternate_countries: "",
          },
        },
        {
          id: "row-2",
          rowIndex: 1,
          data: {
            pg_rop3: "100018.0",
            geo_country_name: "Turkey",
            alternate_countries: "Egypt",
          },
        },
        {
          id: "row-3",
          rowIndex: 2,
          data: {
            pg_rop3: "100021.0",
            geo_country_name: "Egypt",
            alternate_countries: "",
          },
        },
      ],
      page: 1,
      pageSize: 3,
      totalRows: 3,
      pageCount: 1,
    });
    listFieldDefinitionPresentationByColumnKeyMock.mockResolvedValue({
      pg_rop3: {
        definition: "",
        displayLabel: "ROP3",
        effectiveLabel: "ROP3",
        linkedSources: [],
      },
      geo_country_name: {
        definition: "",
        displayLabel: "Country",
        effectiveLabel: "Country",
        linkedSources: [],
      },
    });
  });

  it("rejects unauthenticated downloads", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getSavedDatasetTableMock).not.toHaveBeenCalled();
  });

  it("downloads the saved filtered table as csv", async () => {
    const response = await GET(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="North-Africa-focus.csv"',
    );
    const csv = await response.text();

    expect(csv).toContain("Row number,ROP3,Country");
    expect(csv).toContain("3,100021.0,Egypt");
    expect(csv).not.toContain("Turkey");
  });

  it("includes rows that match the selected country through alternate countries", async () => {
    getSavedDatasetTableMock.mockResolvedValue({
      ...savedTable,
      filters: {
        ...savedTable.filters,
        region: {
          ...savedTable.filters.region,
          enabled: false,
          selectedRegionIds: [],
          selectedRegionNames: [],
          enabledCountryNames: [],
        },
        country: {
          enabled: true,
          selectedCountryNames: ["Egypt"],
          includeAlternateCountries: true,
        },
      },
    });

    const response = await GET(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(200);
    const csv = await response.text();

    expect(csv).toContain("2,100018.0,Turkey");
  });

  it("returns not found when the saved table does not exist", async () => {
    getSavedDatasetTableMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("applies hotspots filtering before the downstream country intersection", async () => {
    getDatasetMock.mockResolvedValue({
      ...dataset,
      columns: [
        {
          key: "pg_rop3",
          label: "ROP3",
          sourceIndex: 0,
        },
        {
          key: "geo_country_name",
          label: "Geo_Country_Name",
          sourceIndex: 1,
        },
        {
          key: "engage_global_engagement_anywhere",
          label: "Engage_Global_Engagement_Anywhere",
          sourceIndex: 2,
        },
        {
          key: "pg_population",
          label: "PG_Population",
          sourceIndex: 3,
        },
        {
          key: "pg_peid",
          label: "PG_PEID",
          sourceIndex: 4,
        },
      ],
    });
    getSavedDatasetTableMock.mockResolvedValue({
      ...savedTable,
      filters: {
        ...savedTable.filters,
        region: {
          enabled: false,
          selectedRegionIds: [],
          selectedRegionNames: [],
          enabledCountryNames: [],
        },
        country: {
          enabled: true,
          selectedCountryNames: ["India"],
          includeAlternateCountries: false,
        },
        hotspots: {
          enabled: true,
          metric: "unique_uupgs" as const,
          countryCount: 1,
        },
      },
    });
    getAllDatasetRowsMock.mockResolvedValue({
      sourceDatasetId: dataset.id,
      rows: [
        {
          id: "row-1",
          rowIndex: 0,
          data: {
            pg_rop3: "100011.0",
            geo_country_name: "India",
            engage_global_engagement_anywhere: "FALSE",
            pg_population: "100",
            pg_peid: "PG-INDIA-1",
          },
        },
        {
          id: "row-2",
          rowIndex: 1,
          data: {
            pg_rop3: "100018.0",
            geo_country_name: "India",
            engage_global_engagement_anywhere: "FALSE",
            pg_population: "200",
            pg_peid: "PG-INDIA-2",
          },
        },
        {
          id: "row-3",
          rowIndex: 2,
          data: {
            pg_rop3: "100021.0",
            geo_country_name: "Nepal",
            engage_global_engagement_anywhere: "FALSE",
            pg_population: "50",
            pg_peid: "PG-NEPAL-1",
          },
        },
        {
          id: "row-4",
          rowIndex: 3,
          data: {
            pg_rop3: "100022.0",
            geo_country_name: "India",
            engage_global_engagement_anywhere: "TRUE",
            pg_population: "999",
            pg_peid: "PG-INDIA-3",
          },
        },
      ],
      page: 1,
      pageSize: 4,
      totalRows: 4,
      pageCount: 1,
    });

    const response = await GET(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(200);
    const csv = await response.text();

    expect(csv).toContain("1,100011.0,India");
    expect(csv).toContain("2,100018.0,India");
    expect(csv).not.toContain("Nepal");
    expect(csv).not.toContain("100022.0");
  });
});
