import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { activateReferenceResource } from "@/lib/reference-resources";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/reference-resources", async (original) => ({ ...(await original<typeof import("@/lib/reference-resources")>()), activateReferenceResource: vi.fn() }));

describe("reference resource rollback route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin", isDatasetAdmin: true, mode: "supabase" });
  });
  it("uses the audited rollback activation action", async () => {
    vi.mocked(activateReferenceResource).mockResolvedValue("set-3");
    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ expectedActiveVersionId: "20000000-0000-4000-8000-000000000002", reason: "Restore last known good" }) }),
      { params: Promise.resolve({ resourceKey: "rop-codes", versionId: "20000000-0000-4000-8000-000000000001" }) },
    );
    expect(response.status).toBe(200);
    expect(activateReferenceResource).toHaveBeenCalledWith(expect.objectContaining({ action: "rollback", reason: "Restore last known good" }));
  });
});
