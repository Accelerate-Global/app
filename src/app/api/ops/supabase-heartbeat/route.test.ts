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

function mockSupabaseReads(results: Array<{ error: Error | null }>) {
  const limit = vi.fn();
  for (const result of results) {
    limit.mockResolvedValueOnce(result);
  }
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

  it("performs three read-only Supabase heartbeat queries for authorized requests", async () => {
    const query = mockSupabaseReads([
      { error: null },
      { error: null },
      { error: null },
    ]);

    const response = await GET(createRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(query.from).toHaveBeenCalledTimes(3);
    expect(query.from).toHaveBeenNthCalledWith(1, "field_definitions");
    expect(query.from).toHaveBeenNthCalledWith(2, "field_definitions");
    expect(query.from).toHaveBeenNthCalledWith(3, "field_definitions");
    expect(query.select).toHaveBeenCalledTimes(3);
    expect(query.select).toHaveBeenNthCalledWith(1, "id");
    expect(query.select).toHaveBeenNthCalledWith(2, "id");
    expect(query.select).toHaveBeenNthCalledWith(3, "id");
    expect(query.limit).toHaveBeenCalledTimes(3);
    expect(query.limit).toHaveBeenNthCalledWith(1, 1);
    expect(query.limit).toHaveBeenNthCalledWith(2, 1);
    expect(query.limit).toHaveBeenNthCalledWith(3, 1);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("returns a service error, logs normalized details, and stops later reads when Supabase fails", async () => {
    const error = new Error("relation not found");
    const query = mockSupabaseReads([
      { error: null },
      { error },
      { error: null },
    ]);

    const response = await GET(createRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Supabase heartbeat failed.",
    });
    expect(logErrorMock).toHaveBeenCalledWith("Supabase heartbeat failed", error);
    expect(query.from).toHaveBeenCalledTimes(2);
    expect(query.select).toHaveBeenCalledTimes(2);
    expect(query.limit).toHaveBeenCalledTimes(2);
  });
});
