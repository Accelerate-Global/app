import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerClient } from "@supabase/ssr";

import { getSupabaseConfig, hasSupabaseConfig } from "@/lib/supabase/config";

import { updateSession } from "./proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: vi.fn(),
  hasSupabaseConfig: vi.fn(),
}));

const createServerClientMock = vi.mocked(createServerClient);
const getSupabaseConfigMock = vi.mocked(getSupabaseConfig);
const hasSupabaseConfigMock = vi.mocked(hasSupabaseConfig);

describe("updateSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasSupabaseConfigMock.mockReturnValue(true);
    getSupabaseConfigMock.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabasePublishableKey: "publishable-key",
    });
  });

  it("returns an untouched pass-through response when Supabase is disabled", async () => {
    hasSupabaseConfigMock.mockReturnValue(false);

    const response = await updateSession(
      new NextRequest("http://localhost/dashboard"),
    );

    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("propagates refreshed cookies and headers", async () => {
    let cookieAdapter:
      | {
          setAll: (
            cookiesToSet: Array<{
              name: string;
              value: string;
              options?: { path?: string };
            }>,
            headers: Record<string, string>,
          ) => void;
        }
      | undefined;

    createServerClientMock.mockImplementation((_url, _key, options) => {
      cookieAdapter = options.cookies as typeof cookieAdapter;

      return {
        auth: {
          getUser: vi.fn(async () => {
            cookieAdapter?.setAll(
              [
                {
                  name: "sb-access-token",
                  value: "refreshed-token",
                  options: { path: "/" },
                },
              ],
              { "x-auth-refresh": "1" },
            );

            return { data: { user: null }, error: null };
          }),
        },
      } as never;
    });

    const request = new NextRequest("http://localhost/dashboard");
    const response = await updateSession(request);

    expect(response.cookies.get("sb-access-token")?.value).toBe(
      "refreshed-token",
    );
    expect(response.headers.get("x-auth-refresh")).toBe("1");
    expect(request.cookies.get("sb-access-token")?.value).toBe(
      "refreshed-token",
    );
  });

  it("swallows refresh failures and still returns a pass-through response", async () => {
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => {
          throw new Error("refresh failed");
        }),
      },
    } as never);

    const response = await updateSession(new NextRequest("http://localhost/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-auth-refresh")).toBeNull();
  });
});
