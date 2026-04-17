import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  createFilterRegion,
  FilterRegionConflictError,
  listFilterRegions,
} from "@/lib/filter-settings";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/filter-settings", () => ({
  createFilterRegion: vi.fn(),
  FilterRegionConflictError: class FilterRegionConflictError extends Error {},
  listFilterRegions: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listFilterRegionsMock = vi.mocked(listFilterRegions);
const createFilterRegionMock = vi.mocked(createFilterRegion);

const adminIdentity = {
  ownerId: "owner-1",
  email: "admin@example.com",
  fullName: "Blake Lewis",
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const region = {
  id: "f0000000-0000-4000-8000-000000000001",
  name: "South Asia",
  description: "Countries across South Asia.",
  sortOrder: 1,
  countries: ["India", "Nepal"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("/api/filter-settings/regions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("rejects non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...adminIdentity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("lists regions for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    listFilterRegionsMock.mockResolvedValue([region]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ regions: [region] });
  });

  it("creates a region for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    createFilterRegionMock.mockResolvedValue(region);

    const response = await POST(
      new Request("http://localhost/api/filter-settings/regions", {
        method: "POST",
        body: JSON.stringify({
          name: "South Asia",
          description: "Countries across South Asia.",
          sortOrder: 1,
          countries: ["India", "Nepal"],
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ region });
    expect(createFilterRegionMock).toHaveBeenCalledWith({
      name: "South Asia",
      description: "Countries across South Asia.",
      sortOrder: 1,
      countries: ["India", "Nepal"],
    });
  });

  it("rejects invalid region payloads", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);

    const response = await POST(
      new Request("http://localhost/api/filter-settings/regions", {
        method: "POST",
        body: JSON.stringify({
          name: "",
          description: "",
          sortOrder: 0,
          countries: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createFilterRegionMock).not.toHaveBeenCalled();
  });

  it("returns conflicts when the name already exists", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    createFilterRegionMock.mockRejectedValue(
      new FilterRegionConflictError("A region with that name already exists."),
    );

    const response = await POST(
      new Request("http://localhost/api/filter-settings/regions", {
        method: "POST",
        body: JSON.stringify({
          name: "South Asia",
          description: "Countries across South Asia.",
          sortOrder: 1,
          countries: ["India", "Nepal"],
        }),
      }),
    );

    expect(response.status).toBe(409);
  });
});
