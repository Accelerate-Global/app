import { beforeEach, describe, expect, it, vi } from "vitest";

import { reconcileStaleApiConnectionRuns } from "@/lib/api-connections/durable-joshua";
import { GET } from "./route";

vi.mock("@/lib/api-connections/durable-joshua", () => ({
  reconcileStaleApiConnectionRuns: vi.fn(),
}));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));

describe("durable API run reconciliation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CRON_SECRET = "cron-secret";
  });

  it("requires the cron bearer secret", async () => {
    const response = await GET(new Request("http://localhost"));
    expect(response.status).toBe(401);
    expect(reconcileStaleApiConnectionRuns).not.toHaveBeenCalled();
  });

  it("reconciles stale runs with a bounded authenticated request", async () => {
    vi.mocked(reconcileStaleApiConnectionRuns).mockResolvedValue(2);
    const response = await GET(
      new Request("http://localhost", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, reconciled: 2 });
  });
});
