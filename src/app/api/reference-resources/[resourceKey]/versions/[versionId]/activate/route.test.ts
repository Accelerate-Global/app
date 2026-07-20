import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { activateReferenceResource, ReferenceResourceConflictError } from "@/lib/reference-resources";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/reference-resources", async (original) => ({ ...(await original<typeof import("@/lib/reference-resources")>()), activateReferenceResource: vi.fn() }));

const context = { params: Promise.resolve({ resourceKey: "rop-codes", versionId: "20000000-0000-4000-8000-000000000002" }) };
const activeId = "20000000-0000-4000-8000-000000000001";

describe("reference resource activation route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin", isDatasetAdmin: true, mode: "supabase" });
  });
  it("requires a reason and expected pointer, then activates atomically", async () => {
    expect((await POST(new Request("http://localhost", { method: "POST", body: "{}" }), context)).status).toBe(400);
    vi.mocked(activateReferenceResource).mockResolvedValue("set-2");
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ expectedActiveVersionId: activeId, reason: "Reviewed upstream changes" }) }), context);
    expect(response.status).toBe(200);
    expect(activateReferenceResource).toHaveBeenCalledWith(expect.objectContaining({ expectedActiveVersionId: activeId, actorOwnerId: "admin-1" }));
  });
  it("maps stale compare-and-swap conflicts to 409", async () => {
    vi.mocked(activateReferenceResource).mockRejectedValue(new ReferenceResourceConflictError("stale"));
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ expectedActiveVersionId: activeId, reason: "Reviewed upstream changes" }) }), context);
    expect(response.status).toBe(409);
  });
});
