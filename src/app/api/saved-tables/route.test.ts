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
  email: "viewer@example.com",
  fullName: null,
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
    watchlist: {
      enabled: true,
      threshold: 2,
      frontierGroupValue: true,
    },
    uupg: {
      enabled: false,
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
    expect(listSavedDatasetTablesMock).toHaveBeenCalledWith("supabase-user");
  });

  it("creates a saved table for any authenticated user", async () => {
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
      filters: savedTable.filters,
    });
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
