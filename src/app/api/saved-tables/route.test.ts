import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  createSavedDatasetTable,
  listSavedDatasetTables,
} from "@/lib/saved-dataset-tables";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/saved-dataset-tables", () => ({
  createSavedDatasetTable: vi.fn(),
  listSavedDatasetTables: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createSavedDatasetTableMock = vi.mocked(createSavedDatasetTable);
const listSavedDatasetTablesMock = vi.mocked(listSavedDatasetTables);

const identity = {
  ownerId: "supabase-user",
  email: "pro@example.com",
  fullName: null,
  workspaceRole: "pro" as const,
  isDatasetAdmin: false,
  mode: "supabase" as const,
};

const savedTable = {
  id: "c0000000-0000-4000-8000-000000000001",
  datasetId: "f0000000-0000-4000-8000-000000000001",
  datasetFileName: "Every People Group.csv",
  name: "Every People Group Saved view 1",
  details: "",
  filters: {
    region: {
      enabled: true,
      selectedRegionIds: ["f1000000-0000-4000-8000-000000000001"],
      selectedRegionNames: ["Globe"],
      enabledCountryNames: ["Egypt", "Turkey"],
    },
    country: {
      enabled: false,
      selectedCountryNames: [],
      includeAlternateCountries: false,
    },
    watchlist: {
      enabled: true,
      threshold: 2,
      engagementPhaseThreshold: 6,
      evangelicalBelieversThreshold: 1000,
      evangelicalPercentThreshold: 0.05,
      frontierGroupValue: true,
    },
    uupg: {
      enabled: false,
      globalEngagementAnywhereEnabled: true,
      frontierGroupEnabled: true,
    },
    sorting: [
      {
        id: "pg_rop3",
        desc: false,
      },
    ],
  },
  savedRowCount: 12,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/saved-tables", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated list requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listSavedDatasetTablesMock).not.toHaveBeenCalled();
  });

  it("lists saved tables for the signed-in user", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    listSavedDatasetTablesMock.mockResolvedValue([savedTable]);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ savedTables: [savedTable] });
    expect(listSavedDatasetTablesMock).toHaveBeenCalledWith("supabase-user", {
      includeDisabled: false,
    });
  });

  it("creates a saved table for pro users", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    createSavedDatasetTableMock.mockResolvedValue(savedTable);

    const response = await POST(
      new Request("http://localhost/api/saved-tables", {
        method: "POST",
        body: JSON.stringify({
          datasetId: savedTable.datasetId,
          savedRowCount: 12,
          filters: savedTable.filters,
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ savedTable });
    expect(createSavedDatasetTableMock).toHaveBeenCalledWith({
      ownerId: "supabase-user",
      datasetId: savedTable.datasetId,
      savedRowCount: 12,
      filters: {
        ...savedTable.filters,
        watchlist: {
          ...savedTable.filters.watchlist,
          thresholdEnabled: true,
          engagementPhaseEnabled: true,
          jpOnlyEvangelicalCriteriaEnabled: true,
          evangelicalPopulationBelieversRuleEnabled: true,
          frontierGroupEnabled: true,
        },
        hotspots: {
          enabled: false,
          metric: "unique_uupgs",
          countryCount: 10,
        },
      },
      includeDisabled: false,
    });
  });

  it("allows admins to create saved tables for datasets they can access", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      workspaceRole: "admin",
      isDatasetAdmin: true,
    });
    createSavedDatasetTableMock.mockResolvedValue(savedTable);

    const response = await POST(
      new Request("http://localhost/api/saved-tables", {
        method: "POST",
        body: JSON.stringify({
          datasetId: savedTable.datasetId,
          savedRowCount: 12,
          filters: savedTable.filters,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createSavedDatasetTableMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "supabase-user",
        datasetId: savedTable.datasetId,
        includeDisabled: true,
      }),
    );
  });

  it("rejects saved table creation for basic users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      workspaceRole: "basic",
    });

    const response = await POST(
      new Request("http://localhost/api/saved-tables", {
        method: "POST",
        body: JSON.stringify({
          datasetId: savedTable.datasetId,
          savedRowCount: 12,
          filters: savedTable.filters,
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Basic accounts cannot save dataset tables.",
    });
    expect(createSavedDatasetTableMock).not.toHaveBeenCalled();
  });

  it("returns not found when the source dataset does not exist", async () => {
    getCurrentIdentityMock.mockResolvedValue(identity);
    createSavedDatasetTableMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/saved-tables", {
        method: "POST",
        body: JSON.stringify({
          datasetId: savedTable.datasetId,
          savedRowCount: 12,
          filters: savedTable.filters,
        }),
      }),
    );

    expect(response.status).toBe(404);
  });
});
