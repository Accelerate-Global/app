import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { publishImbFormingRun } from "@/lib/imb-forming";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/imb-forming", () => ({ publishImbFormingRun: vi.fn() }));

const identity = { ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin" as const, isDatasetAdmin: true, mode: "supabase" as const };
const context = { params: Promise.resolve({ connectionId: "connection-1", runId: "run-1", formingRunId: "forming-1" }) };

describe("IMB forming candidate publish route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("publishes with warning acknowledgement", async () => {
    vi.mocked(publishImbFormingRun).mockResolvedValue({ id: "forming-1", status: "published" } as never);
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "Reviewed", warningsAcknowledged: true }) }), context);
    expect(response.status).toBe(200);
    expect(publishImbFormingRun).toHaveBeenCalledWith(expect.objectContaining({ decision: { reason: "Reviewed", warningsAcknowledged: true } }));
  });

  it("requires a reason", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }), context);
    expect(response.status).toBe(400);
  });
});
