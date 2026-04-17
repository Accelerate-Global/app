import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  deleteSavedDatasetTable,
  getSavedDatasetTable,
  updateSavedDatasetTable,
} from "@/lib/saved-dataset-tables";
import { DELETE, GET, PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/saved-dataset-tables", () => ({
  deleteSavedDatasetTable: vi.fn(),
  getSavedDatasetTable: vi.fn(),
  updateSavedDatasetTable: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const deleteSavedDatasetTableMock = vi.mocked(deleteSavedDatasetTable);
const getSavedDatasetTableMock = vi.mocked(getSavedDatasetTable);
const updateSavedDatasetTableMock = vi.mocked(updateSavedDatasetTable);

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
    sorting: [],
  },
  savedRowCount: 12,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/saved-tables/[savedTableId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated saved table requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(401);
    expect(getSavedDatasetTableMock).not.toHaveBeenCalled();
  });

  it("returns a saved table owned by the signed-in user", async () => {
    getSavedDatasetTableMock.mockResolvedValue(savedTable);

    const response = await GET(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ savedTable });
    expect(getSavedDatasetTableMock).toHaveBeenCalledWith({
      ownerId: "supabase-user",
      savedTableId: savedTable.id,
    });
  });

  it("updates saved table metadata for the owner", async () => {
    updateSavedDatasetTableMock.mockResolvedValue({
      ...savedTable,
      name: "North Africa focus",
      details: "Saved from dataset detail page.",
    });

    const response = await PATCH(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({
          name: "North Africa focus",
          details: "Saved from dataset detail page.",
        }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(updateSavedDatasetTableMock).toHaveBeenCalledWith({
      ownerId: "supabase-user",
      savedTableId: savedTable.id,
      name: "North Africa focus",
      details: "Saved from dataset detail page.",
    });
  });

  it("deletes saved tables for the owner", async () => {
    deleteSavedDatasetTableMock.mockResolvedValue(savedTable);

    const response = await DELETE(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001"),
      context,
    );

    expect(response.status).toBe(200);
    expect(deleteSavedDatasetTableMock).toHaveBeenCalledWith({
      ownerId: "supabase-user",
      savedTableId: savedTable.id,
    });
  });

  it("returns not found when a saved table is missing", async () => {
    updateSavedDatasetTableMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/saved-tables/c0000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({
          name: "North Africa focus",
        }),
      }),
      context,
    );

    expect(response.status).toBe(404);
  });
});
