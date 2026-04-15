import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  deleteFilterRegion,
  FilterRegionConflictError,
  updateFilterRegion,
} from "@/lib/filter-settings";
import { DELETE, PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/filter-settings", () => ({
  deleteFilterRegion: vi.fn(),
  FilterRegionConflictError: class FilterRegionConflictError extends Error {},
  updateFilterRegion: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const updateFilterRegionMock = vi.mocked(updateFilterRegion);
const deleteFilterRegionMock = vi.mocked(deleteFilterRegion);

const adminIdentity = {
  ownerId: "owner-1",
  email: "admin@example.com",
  fullName: "Blake Lewis",
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const context = {
  params: Promise.resolve({
    regionId: "f0000000-0000-4000-8000-000000000001",
  }),
};

const region = {
  id: "f0000000-0000-4000-8000-000000000001",
  name: "South Asia",
  description: "Countries across South East Asia.",
  sortOrder: 1,
  countries: ["India", "Nepal"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/filter-settings/regions/[regionId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated patch requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/filter-settings/regions/1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "South Asia",
          description: "",
          sortOrder: 1,
          countries: ["India"],
        }),
      }),
      context,
    );

    expect(response.status).toBe(401);
  });

  it("updates a region for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    updateFilterRegionMock.mockResolvedValue(region);

    const response = await PATCH(
      new Request("http://localhost/api/filter-settings/regions/1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "South Asia",
          description: "Countries across South East Asia.",
          sortOrder: 1,
          countries: ["India", "Nepal"],
        }),
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ region });
    expect(updateFilterRegionMock).toHaveBeenCalledWith({
      regionId: "f0000000-0000-4000-8000-000000000001",
      name: "South Asia",
      description: "Countries across South East Asia.",
      sortOrder: 1,
      countries: ["India", "Nepal"],
    });
  });

  it("returns 404 when updating a missing region", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    updateFilterRegionMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/filter-settings/regions/1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "South Asia",
          description: "",
          sortOrder: 1,
          countries: ["India"],
        }),
      }),
      context,
    );

    expect(response.status).toBe(404);
  });

  it("returns conflicts when renaming to an existing region", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    updateFilterRegionMock.mockRejectedValue(
      new FilterRegionConflictError("A region with that name already exists."),
    );

    const response = await PATCH(
      new Request("http://localhost/api/filter-settings/regions/1", {
        method: "PATCH",
        body: JSON.stringify({
          name: "South Asia",
          description: "",
          sortOrder: 1,
          countries: ["India"],
        }),
      }),
      context,
    );

    expect(response.status).toBe(409);
  });

  it("deletes a region for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    deleteFilterRegionMock.mockResolvedValue({ id: region.id });

    const response = await DELETE(
      new Request("http://localhost/api/filter-settings/regions/1", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ regionId: region.id });
  });

  it("returns 404 when deleting a missing region", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    deleteFilterRegionMock.mockResolvedValue(null as never);

    const response = await DELETE(
      new Request("http://localhost/api/filter-settings/regions/1", {
        method: "DELETE",
      }),
      context,
    );

    expect(response.status).toBe(404);
  });
});
