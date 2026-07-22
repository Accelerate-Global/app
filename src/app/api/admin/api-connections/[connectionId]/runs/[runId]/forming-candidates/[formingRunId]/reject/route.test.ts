import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { rejectImbFormingRun } from "@/lib/imb-forming";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/imb-forming", () => ({ rejectImbFormingRun: vi.fn() }));

const identity = { ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin" as const, isDatasetAdmin: true, mode: "supabase" as const };
const context = { params: Promise.resolve({ connectionId: "connection-1", runId: "run-1", formingRunId: "forming-1" }) };

describe("IMB forming candidate reject route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("records a validated rejection", async () => {
    vi.mocked(rejectImbFormingRun).mockResolvedValue({ id: "forming-1", status: "rejected" } as never);
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "Source mismatch" }) }), context);
    expect(response.status).toBe(200);
    expect(rejectImbFormingRun).toHaveBeenCalledWith(expect.objectContaining({ decision: { reason: "Source mismatch" } }));
  });

  it("requires a reason", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "" }) }), context);
    expect(response.status).toBe(400);
  });
});
