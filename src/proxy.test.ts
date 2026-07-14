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
    vi.clearAllMocks();
    updateSessionMock.mockResolvedValue(NextResponse.next());
  });

  it("allows same-origin api mutations through to the session updater", async () => {
    const request = new NextRequest(
      "https://data.accelerateglobal.org/api/account/disable",
      {
        method: "POST",
        headers: { origin: "https://data.accelerateglobal.org" },
      },
    );

    const response = await proxy(request);

    expect(updateSessionMock).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        requestHeaders: expect.any(Headers),
        responseHeaders: expect.any(Headers),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("allows same-origin sign-out requests through to the session updater", async () => {
    const request = new NextRequest(
      "https://data.accelerateglobal.org/auth/sign-out",
      {
        method: "POST",
        headers: { origin: "https://data.accelerateglobal.org" },
      },
    );

    const response = await proxy(request);

    expect(updateSessionMock).toHaveBeenCalledWith(
      request,
      expect.any(Object),
    );
    expect(response.status).toBe(200);
  });

  it("rejects api mutations without an origin header", async () => {
    const response = await proxy(
      new NextRequest("https://data.accelerateglobal.org/api/datasets", {
        method: "DELETE",
      }),
    );

    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request origin.",
    });
  });

  it("allows non-mutating api requests", async () => {
    const request = new NextRequest(
      "https://data.accelerateglobal.org/api/datasets",
      { method: "GET" },
    );

    const response = await proxy(request);

    expect(updateSessionMock).toHaveBeenCalledWith(
      request,
      expect.any(Object),
    );
    expect(response.status).toBe(200);
  });

  it("allows non-api page requests", async () => {
    const request = new NextRequest(
      "https://data.accelerateglobal.org/dashboard",
      { method: "POST" },
    );

    const response = await proxy(request);

    expect(updateSessionMock).toHaveBeenCalledWith(
      request,
      expect.any(Object),
    );
    expect(response.status).toBe(200);
  });

  it("provides one request-specific nonce to Next and the browser", async () => {
    await proxy(new NextRequest("https://app.example.com/dashboard"));

    expect(updateSessionMock).toHaveBeenCalledOnce();
    const options = updateSessionMock.mock.calls[0]?.[1];
    const nonce = options?.requestHeaders?.get("x-nonce");
    const requestPolicy = options?.requestHeaders?.get(
      "Content-Security-Policy",
    );
    const responsePolicy = options?.responseHeaders?.get(
      "Content-Security-Policy",
    );

    expect(nonce).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
    expect(requestPolicy).toBe(responsePolicy);
    expect(responsePolicy).toContain(`'nonce-${nonce}'`);
    expect(responsePolicy).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it("uses a different nonce for every request", async () => {
    await proxy(new NextRequest("https://app.example.com/dashboard"));
    await proxy(new NextRequest("https://app.example.com/dashboard"));

    const first = updateSessionMock.mock.calls[0]?.[1]?.requestHeaders?.get("x-nonce");
    const second = updateSessionMock.mock.calls[1]?.[1]?.requestHeaders?.get("x-nonce");
    expect(first).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it("keeps the nonce CSP and private caching on rejected cross-origin mutations", async () => {
    const response = await proxy(
      new NextRequest("https://app.example.com/api/datasets", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "'strict-dynamic'",
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(updateSessionMock).not.toHaveBeenCalled();
  });
});
