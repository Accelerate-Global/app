import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logError } from "@/lib/error-logging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);
const logErrorMock = vi.mocked(logError);

function createRequest(authorization?: string) {
  return new Request("http://localhost/api/ops/supabase-heartbeat", {
    headers: authorization ? { authorization } : undefined,
  });
}

function mockSupabaseRead(result: { error: Error | null }) {
  const limit = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ select });

  createSupabaseAdminClientMock.mockReturnValue({ from } as never);

  return { from, select, limit };
}

describe("/api/ops/supabase-heartbeat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(createRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Supabase heartbeat is not configured.",
    });
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("rejects requests without the cron bearer secret", async () => {
    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong cron bearer secret", async () => {
    const response = await GET(createRequest("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("performs one read-only Supabase heartbeat query for authorized requests", async () => {
    const query = mockSupabaseRead({ error: null });

    const response = await GET(createRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(query.from).toHaveBeenCalledWith("field_definitions");
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("returns a service error and logs normalized details when Supabase fails", async () => {
    const error = new Error("relation not found");
    mockSupabaseRead({ error });

    const response = await GET(createRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Supabase heartbeat failed.",
    });
    expect(logErrorMock).toHaveBeenCalledWith("Supabase heartbeat failed", error);
  });
});
