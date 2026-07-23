import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getDatasetFormingResourceImpact } from "@/lib/dataset-forming/impact";
import { listReferenceResourceActivationHistory, listReferenceResourceVersions } from "@/lib/reference-resources";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/dataset-forming/impact", () => ({ getDatasetFormingResourceImpact: vi.fn() }));
vi.mock("@/lib/reference-resources", () => ({ listReferenceResourceVersions: vi.fn(), listReferenceResourceActivationHistory: vi.fn() }));

describe("reference resource history route", () => {
  beforeEach(() => vi.resetAllMocks());
  it("is admin-only and returns immutable version plus activation history", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin", isDatasetAdmin: true, mode: "supabase" });
    vi.mocked(listReferenceResourceVersions).mockResolvedValue([{
      id: "10000000-0000-4000-8000-000000000001",
      resourceKey: "rop-codes",
      versionNumber: 2,
      lifecycleState: "valid",
      schemaVersion: 1,
      contentChecksum: "a".repeat(64),
      sourceRetrievedAt: "2026-07-17T00:00:00.000Z",
      entryCount: 12_000,
      validationSummary: {},
      diffSummary: {},
      createdByOwnerId: "admin-1",
      createdAt: "2026-07-17T00:00:00.000Z",
      finalizedAt: "2026-07-17T00:00:00.000Z",
      rejectionReason: null,
      isActive: true,
    }]);
    vi.mocked(listReferenceResourceActivationHistory).mockResolvedValue([]);
    vi.mocked(getDatasetFormingResourceImpact).mockResolvedValue({
      resourceKey: "rop-codes",
      affectedEngines: [{
        engineKey: "imb",
        displayName: "IMB source forming",
        sourceProfileKeys: ["imb-people-groups"],
        publicationTargetKey: "imb-people-groups",
      }],
      olderBindings: [],
    });
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ resourceKey: "rop-codes" }) });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.impact.affectedEngines[0].displayName).toBe("IMB source forming");
    expect(getDatasetFormingResourceImpact).toHaveBeenCalledWith({
      resourceKey: "rop-codes",
      currentVersionId: "10000000-0000-4000-8000-000000000001",
      currentChecksum: "a".repeat(64),
    });
  });
});
