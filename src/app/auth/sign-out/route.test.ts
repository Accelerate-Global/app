import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";

const {
  signOutMock,
  createServerClientMock,
  hasSupabaseConfigMock,
  getSupabaseConfigMock,
  logErrorMock,
} = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  createServerClientMock: vi.fn(),
  hasSupabaseConfigMock: vi.fn(() => false),
  getSupabaseConfigMock: vi.fn(() => ({
    supabaseUrl: "https://supabase.example",
    supabasePublishableKey: "publishable-key",
  })),
  logErrorMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: hasSupabaseConfigMock,
  getSupabaseConfig: getSupabaseConfigMock,
}));

vi.mock("@/lib/error-logging", () => ({
  logError: logErrorMock,
}));

describe("/auth/sign-out", () => {
  it("preserves Supabase sign-out cookies on the response", async () => {
    hasSupabaseConfigMock.mockReturnValue(true);
    signOutMock.mockResolvedValue({ error: null });

    createServerClientMock.mockImplementation((_url, _key, options) => {
      options.cookies.setAll(
        [
          {
            name: "sb-auth-token",
            value: "",
            options: { path: "/", maxAge: 0 },
          },
        ],
        {
          "Cache-Control":
            "private, no-cache, no-store, must-revalidate, max-age=0",
          Expires: "0",
          Pragma: "no-cache",
        },
      );

      return {
        auth: {
          signOut: signOutMock,
        },
      };
    });

    const request = new NextRequest("http://localhost/auth/sign-out", {
      method: "POST",
      headers: {
        cookie: "sb-auth-token=active-session",
      },
    });

    const response = await POST(request);

    expect(createServerClientMock).toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("sb-auth-token=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns ok when Supabase config is disabled", async () => {
    hasSupabaseConfigMock.mockReturnValue(false);
    const response = await POST(
      new NextRequest("http://localhost/auth/sign-out", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("logs normalized sign-out failures without breaking the response", async () => {
    hasSupabaseConfigMock.mockReturnValue(true);
    const error = new Error("sign-out failed");
    signOutMock.mockRejectedValue(error);
    createServerClientMock.mockReturnValue({
      auth: {
        signOut: signOutMock,
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/auth/sign-out", {
        method: "POST",
        headers: {
          cookie: "sb-auth-token=active-session",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(logErrorMock).toHaveBeenCalledWith("Failed to sign out of Supabase", error);
  });
});
