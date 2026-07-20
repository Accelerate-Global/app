import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { rejectReferenceResourceVersion } from "@/lib/reference-resources";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/reference-resources", async (original) => ({ ...(await original<typeof import("@/lib/reference-resources")>()), rejectReferenceResourceVersion: vi.fn() }));

describe("reference resource rejection route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin", isDatasetAdmin: true, mode: "supabase" });
  });
  it("requires a reason and rejects only through the lifecycle service", async () => {
    vi.mocked(rejectReferenceResourceVersion).mockResolvedValue({ id: "version-2" } as never);
    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "Source regression" }) }),
      { params: Promise.resolve({ resourceKey: "country-territory-codes", versionId: "20000000-0000-4000-8000-000000000002" }) },
    );
    expect(response.status).toBe(200);
    expect(rejectReferenceResourceVersion).toHaveBeenCalledWith(expect.objectContaining({ reason: "Source regression", actorOwnerId: "admin-1" }));
  });
});
