import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { refreshRopCodeResourceFromHis } from "@/lib/rop-codes";
import type { RopCodeResource } from "@/lib/rop-codes";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/rop-codes", () => ({
  refreshRopCodeResourceFromHis: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const refreshRopCodeResourceFromHisMock = vi.mocked(refreshRopCodeResourceFromHis);

const resource = {
  sourceName: "HIS Registry of Peoples",
  sourceUrl: "https://hisregistries.org/rop/",
  featureServerUrl: "https://example.test/FeatureServer",
  sourceRetrievedAt: "2026-05-07T00:00:00.000Z",
  entryCount: 0,
  rop1Count: 0,
  rop2Count: 0,
  rop25Count: 0,
  rop3Count: 0,
  geoIndexCount: 0,
  joinIssueCounts: {
    "missing-rop25": 0,
    "parent-only-rop25": 0,
    "rop2-conflict": 0,
  },
  rop1DetailsByCode: {},
  rop2DetailsByCode: {},
  rop25DetailsByCode: {},
  rop3DetailsByCode: {},
  entries: [],
  geoIndexByRop3: {},
} satisfies RopCodeResource;

describe("/api/rop-codes/refresh", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects anonymous refresh requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(refreshRopCodeResourceFromHisMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin refresh requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: null,
      workspaceRole: "pro",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only admins can refresh ROP codes.",
    });
    expect(refreshRopCodeResourceFromHisMock).not.toHaveBeenCalled();
  });

  it("returns live ROP code resource for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    refreshRopCodeResourceFromHisMock.mockResolvedValue(resource);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(resource);
  });

  it("returns a gateway error when HIS refresh fails", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    refreshRopCodeResourceFromHisMock.mockRejectedValue(new Error("HIS unavailable"));

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Could not refresh ROP codes.",
    });
  });
});
