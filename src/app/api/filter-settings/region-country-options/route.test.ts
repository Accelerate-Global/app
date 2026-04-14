import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { listRegionCountryOptions } from "@/lib/filter-settings";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/filter-settings", () => ({
  listRegionCountryOptions: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listRegionCountryOptionsMock = vi.mocked(listRegionCountryOptions);

const adminIdentity = {
  ownerId: "owner-1",
  email: "admin@example.com",
  fullName: "Blake Lewis",
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/filter-settings/region-country-options", () => {
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

  it("returns distinct country options for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue(adminIdentity);
    listRegionCountryOptionsMock.mockResolvedValue(["India", "Nepal"]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      countries: ["India", "Nepal"],
    });
  });
});
