import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "@/lib/supabase/proxy";

import { proxy } from "./proxy";

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(),
}));

const updateSessionMock = vi.mocked(updateSession);

describe("proxy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    updateSessionMock.mockResolvedValue(NextResponse.next());
  });

  it("allows same-origin api mutations through to the session updater", async () => {
    const request = new NextRequest("https://data.accelerateglobal.org/api/account/disable", {
      method: "POST",
      headers: {
        origin: "https://data.accelerateglobal.org",
      },
    });

    const response = await proxy(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });

  it("allows same-origin sign-out requests through to the session updater", async () => {
    const request = new NextRequest("https://data.accelerateglobal.org/auth/sign-out", {
      method: "POST",
      headers: {
        origin: "https://data.accelerateglobal.org",
      },
    });

    const response = await proxy(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });

  it("rejects api mutations with a cross-origin origin header", async () => {
    const request = new NextRequest("https://data.accelerateglobal.org/api/admin/users", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
      },
    });

    const response = await proxy(request);

    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request origin." });
  });

  it("rejects api mutations without an origin header", async () => {
    const request = new NextRequest("https://data.accelerateglobal.org/api/datasets", {
      method: "DELETE",
    });

    const response = await proxy(request);

    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request origin." });
  });

  it("allows non-mutating api requests", async () => {
    const request = new NextRequest("https://data.accelerateglobal.org/api/datasets", {
      method: "GET",
    });

    const response = await proxy(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });

  it("allows non-api page requests", async () => {
    const request = new NextRequest("https://data.accelerateglobal.org/dashboard", {
      method: "POST",
    });

    const response = await proxy(request);

    expect(updateSessionMock).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
  });
});
