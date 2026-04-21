import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getAllDatasetRows, getDataset } from "@/lib/datasets";
import { logError } from "@/lib/error-logging";
import { listFieldDefinitionPresentationByColumnKey } from "@/lib/field-definitions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

const { createSignedUrlMock, fromMock } = vi.hoisted(() => {
  const createSignedUrlMock = vi.fn();
  const fromMock = vi.fn(() => ({
    createSignedUrl: createSignedUrlMock,
  }));

  return { createSignedUrlMock, fromMock };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    storage: {
      from: fromMock,
    },
  })),
}));

vi.mock("@/lib/datasets", () => ({
  getAllDatasetRows: vi.fn(),
  getDataset: vi.fn(),
}));

vi.mock("@/lib/field-definitions", () => ({
  listFieldDefinitionPresentationByColumnKey: vi.fn(),
}));

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

const getAllDatasetRowsMock = vi.mocked(getAllDatasetRows);
const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getDatasetMock = vi.mocked(getDataset);
const listFieldDefinitionPresentationByColumnKeyMock = vi.mocked(
  listFieldDefinitionPresentationByColumnKey,
);
const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);
const logErrorMock = vi.mocked(logError);

const adminIdentity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: null,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const viewerIdentity = {
  ownerId: "viewer-user",
  email: "viewer@example.com",
  fullName: null,
  isDatasetAdmin: false,
  mode: "supabase" as const,
};

const context = {
  params: Promise.resolve({
    datasetId: "f0000000-0000-4000-8000-000000000001",
  }),
};

const physicalDataset = {
  id: "f0000000-0000-4000-8000-000000000001",
  backingDatasetId: null,
  sortOrder: 0,
  fileName: "customers.csv",
  blobUrl:
    "https://example.supabase.co/storage/v1/object/datasets/datasets/csv/customers.csv",
  blobPath: "datasets/csv/customers.csv",
  isPrimary: false,
  isPublic: true,
  status: "ready" as const,
  rowCount: 10,
  sizeBytes: 100,
  columns: [{ key: "email", label: "Email", sourceIndex: 0 }],
  hiddenColumnKeys: [],
  tags: [],
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const derivedDataset = {
  ...physicalDataset,
  id: "f0000000-0000-4000-8000-000000000099",
  backingDatasetId: physicalDataset.id,
  fileName: "Watchlist.csv",
  tags: [
    {
      id: "tag-1",
      label: "Watchlist",
      color: "#262531",
      openPreset: {
        region: {
          enabled: false,
          selectedRegionIds: [],
          selectedRegionNames: [],
          enabledCountryNames: [],
        },
        country: {
          enabled: true,
          selectedCountryNames: ["Egypt"],
        },
        watchlist: {
          enabled: false,
          thresholdEnabled: true,
          threshold: 2,
          engagementPhaseEnabled: true,
          engagementPhaseThreshold: 6,
          evangelicalPopulationBelieversRuleEnabled: true,
          evangelicalPopulationBelieversRule: {
            tiers: [
              {
                minPopulation: 0,
                maxPopulation: null,
                minBelievers: 50,
              },
            ],
          },
          frontierGroupEnabled: true,
          frontierGroupValue: true,
        },
        uupg: {
          enabled: false,
        },
        hotspots: {
          enabled: false,
          metric: "unique_uupgs" as const,
          countryCount: 10,
        },
      },
    },
  ],
};

describe("/api/datasets/[datasetId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentIdentityMock.mockResolvedValue(viewerIdentity);
    getDatasetMock.mockResolvedValue(physicalDataset);
    getAllDatasetRowsMock.mockResolvedValue({
      sourceDatasetId: physicalDataset.id,
      rows: [
        {
          id: "row-1",
          rowIndex: 0,
          data: { email: "ada@example.com", geo_country_name: "Egypt" },
        },
      ],
      page: 1,
      pageSize: 1,
      totalRows: 1,
      pageCount: 1,
    });
    listFieldDefinitionPresentationByColumnKeyMock.mockResolvedValue({
      email: {
        definition: "",
        displayLabel: "Email",
        effectiveLabel: "Email",
        linkedSources: [],
      },
      geo_country_name: {
        definition: "",
        displayLabel: "Country",
        effectiveLabel: "Country",
        linkedSources: [],
      },
    });
    createSignedUrlMock.mockResolvedValue({
      data: {
        signedUrl: "https://example.supabase.co/storage/v1/object/sign/datasets/csv/customers.csv",
      },
      error: null,
    });
  });

  it("rejects unauthenticated downloads", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getDatasetMock).not.toHaveBeenCalled();
  });

  it("returns not found when the dataset does not exist", async () => {
    getDatasetMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(404);
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("creates a signed download URL for physical datasets", async () => {
    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://example.supabase.co/storage/v1/object/sign/datasets/csv/customers.csv",
    );
    expect(createSupabaseAdminClientMock).toHaveBeenCalledWith();
    expect(fromMock).toHaveBeenCalledWith("datasets");
    expect(createSignedUrlMock).toHaveBeenCalledWith(physicalDataset.blobPath, 60, {
      download: physicalDataset.fileName,
    });
    expect(getDatasetMock).toHaveBeenCalledWith(physicalDataset.id, {
      includeDisabled: false,
    });
    expect(getAllDatasetRowsMock).not.toHaveBeenCalled();
  });

  it("exports filtered csv data for derived datasets", async () => {
    getDatasetMock.mockResolvedValue({
      ...derivedDataset,
      columns: [
        { key: "email", label: "Email", sourceIndex: 0 },
        { key: "geo_country_name", label: "Country", sourceIndex: 1 },
      ],
    });
    getAllDatasetRowsMock.mockResolvedValue({
      sourceDatasetId: physicalDataset.id,
      rows: [
        {
          id: "row-1",
          rowIndex: 0,
          data: { email: "ada@example.com", geo_country_name: "Egypt" },
        },
        {
          id: "row-2",
          rowIndex: 1,
          data: { email: "grace@example.com", geo_country_name: "Turkey" },
        },
      ],
      page: 1,
      pageSize: 2,
      totalRows: 2,
      pageCount: 1,
    });

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      {
        params: Promise.resolve({
          datasetId: derivedDataset.id,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="Watchlist-filtered.csv"',
    );
    await expect(response.text()).resolves.toContain("1,Egypt,ada@example.com");
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
    expect(getAllDatasetRowsMock).toHaveBeenCalledWith({
      datasetId: derivedDataset.id,
      includeDisabled: false,
    });
  });

  it("also allows admins to download datasets", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(302);
  });

  it("returns a gateway error when signing fails", async () => {
    const error = new Error("boom");
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error,
    });

    const response = await GET(
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      context,
    );

    expect(response.status).toBe(502);
    expect(logErrorMock).toHaveBeenCalledWith(
      "Failed to create a signed dataset download URL",
      error,
    );
  });

  it("exports derived dataset csvs with hotspots filtering", async () => {
    getDatasetMock.mockResolvedValue({
      ...derivedDataset,
      columns: [
        { key: "email", label: "Email", sourceIndex: 0 },
        { key: "geo_country_name", label: "Geo_Country_Name", sourceIndex: 1 },
        {
          key: "engage_global_engagement_anywhere",
          label: "Engage_Global_Engagement_Anywhere",
          sourceIndex: 2,
        },
        { key: "pg_population", label: "PG_Population", sourceIndex: 3 },
        { key: "pg_peid", label: "PG_PEID", sourceIndex: 4 },
      ],
      tags: [
        {
          id: "tag-1",
          label: "Hotspots",
          color: "#262531",
          openPreset: {
            region: {
              enabled: false,
              selectedRegionIds: [],
              selectedRegionNames: [],
              enabledCountryNames: [],
            },
            country: {
              enabled: false,
              selectedCountryNames: [],
            },
            watchlist: {
              enabled: false,
              thresholdEnabled: true,
              threshold: 2,
              engagementPhaseEnabled: true,
              engagementPhaseThreshold: 6,
              evangelicalPopulationBelieversRuleEnabled: true,
              evangelicalPopulationBelieversRule: {
                tiers: [
                  {
                    minPopulation: 0,
                    maxPopulation: null,
                    minBelievers: 50,
                  },
                ],
              },
              frontierGroupEnabled: true,
              frontierGroupValue: true,
            },
            uupg: {
              enabled: false,
            },
            hotspots: {
              enabled: true,
              metric: "unique_uupgs" as const,
              countryCount: 1,
            },
          },
        },
      ],
    });
    getAllDatasetRowsMock.mockResolvedValue({
      sourceDatasetId: physicalDataset.id,
      rows: [
        {
          id: "row-1",
          rowIndex: 0,
          data: {
            email: "ada@example.com",
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
            email: "grace@example.com",
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
            email: "linus@example.com",
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
            email: "skip@example.com",
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
      new Request("http://localhost/api/datasets/f0000000-0000-4000-8000-000000000001/download"),
      {
        params: Promise.resolve({
          datasetId: derivedDataset.id,
        }),
      },
    );

    expect(response.status).toBe(200);
    const csv = await response.text();

    expect(csv).toContain("1,India,ada@example.com");
    expect(csv).toContain("2,India,grace@example.com");
    expect(csv).not.toContain("Nepal");
    expect(csv).not.toContain("skip@example.com");
  });
});
