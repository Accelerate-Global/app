import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { reviewAxIdentityChangeDecision } from "@/lib/identity-registry";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/identity-registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/identity-registry")>()),
  reviewAxIdentityChangeDecision: vi.fn(),
}));

const identity = {
  ownerId: "admin-1",
  email: "admin@example.org",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("identity component change decision route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("records one supported reviewed action", async () => {
    vi.mocked(reviewAxIdentityChangeDecision).mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/admin/identity-registry/runs/run/decisions/decision", {
        method: "POST",
        body: JSON.stringify({ action: "rebind" }),
      }),
      { params: Promise.resolve({ runId: "run-1", decisionId: "decision-1" }) },
    );
    expect(response.status).toBe(200);
    expect(reviewAxIdentityChangeDecision).toHaveBeenCalledWith({
      runId: "run-1",
      decisionId: "decision-1",
      action: "rebind",
      identity,
    });
  });

  it("rejects unsupported actions before mutation", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/identity-registry/runs/run/decisions/decision", {
        method: "POST",
        body: JSON.stringify({ action: "merge-anyway" }),
      }),
      { params: Promise.resolve({ runId: "run-1", decisionId: "decision-1" }) },
    );
    expect(response.status).toBe(400);
    expect(reviewAxIdentityChangeDecision).not.toHaveBeenCalled();
  });
});
