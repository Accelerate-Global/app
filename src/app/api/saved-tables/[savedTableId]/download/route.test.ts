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
    watchlist: {
      enabled: false,
      threshold: 2,
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
      rows: [
        {
          id: "row-1",
          rowIndex: 0,
          data: {
            pg_rop3: "100011.0",
            geo_country_name: "Egypt",
          },
        },
        {
          id: "row-2",
          rowIndex: 1,
          data: {
            pg_rop3: "100018.0",
            geo_country_name: "Turkey",
          },
        },
        {
          id: "row-3",
          rowIndex: 2,
          data: {
            pg_rop3: "100021.0",
            geo_country_name: "Egypt",
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

    expect(csv).toContain("Row number,Country,ROP3");
    expect(csv).toContain("3,Egypt,100021.0");
    expect(csv).not.toContain("Turkey");
  });

  it("returns not found when the saved table does not exist", async () => {
    getSavedDatasetTableMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(404);
  });
});
