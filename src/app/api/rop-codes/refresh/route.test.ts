import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import type { RopCodeResource } from "@/lib/rop-codes";
import { refreshReferenceResourceCandidate } from "@/lib/reference-resources/refresh";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/reference-resources/refresh", () => ({
  refreshReferenceResourceCandidate: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const refreshReferenceResourceCandidateMock = vi.mocked(
  refreshReferenceResourceCandidate,
);

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

  it("rejects GET refresh requests", async () => {
    const response = GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed.",
    });
    expect(refreshReferenceResourceCandidateMock).not.toHaveBeenCalled();
  });

  it("rejects anonymous refresh requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(refreshReferenceResourceCandidateMock).not.toHaveBeenCalled();
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

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only admins can refresh ROP codes.",
    });
    expect(refreshReferenceResourceCandidateMock).not.toHaveBeenCalled();
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
    const candidate = {
      unchanged: false,
      version: {
        id: "candidate-1",
        resourceKey: "rop-codes",
        versionNumber: 2,
        lifecycleState: "valid",
        schemaVersion: 1,
        contentChecksum: "b".repeat(64),
        sourceRetrievedAt: resource.sourceRetrievedAt,
        entryCount: resource.entryCount,
        validationSummary: {},
        diffSummary: {},
        createdByOwnerId: "owner-1",
        createdAt: resource.sourceRetrievedAt,
        finalizedAt: resource.sourceRetrievedAt,
        rejectionReason: null,
        isActive: false,
      },
    } as const;
    refreshReferenceResourceCandidateMock.mockResolvedValue(candidate);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(refreshReferenceResourceCandidateMock).toHaveBeenCalledWith({
      resourceKey: "rop-codes",
      actorOwnerId: "owner-1",
    });
    await expect(response.json()).resolves.toEqual(candidate);
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
    refreshReferenceResourceCandidateMock.mockRejectedValue(
      new Error("HIS unavailable"),
    );

    const response = await POST();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Could not refresh ROP codes.",
    });
  });
});

describe("route guard integration", () => {
  it("uses the centralized route guard", async () => {
    const source = await readFile(
      "src/app/api/rop-codes/refresh/route.ts",
      "utf8",
    );

    expect(source).toContain('from "@/lib/route-guard"');
    expect(source).toContain("withRoute(");
  });
});
