import { createServerClient } from "@supabase/ssr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { getSupabaseConfig, hasSupabaseConfig } from "@/lib/supabase/config";
import { GET } from "./route";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: vi.fn(),
  hasSupabaseConfig: vi.fn(),
}));

const hasSupabaseConfigMock = vi.mocked(hasSupabaseConfig);
const getSupabaseConfigMock = vi.mocked(getSupabaseConfig);
const createServerClientMock = vi.mocked(createServerClient);

describe("/auth/confirm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasSupabaseConfigMock.mockReturnValue(true);
    getSupabaseConfigMock.mockReturnValue({
      supabaseUrl: "http://localhost:54321",
      supabasePublishableKey: "publishable-key",
    });
  });

  it("redirects successful code exchanges to the requested next path", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession, verifyOtp: vi.fn() },
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?code=auth-code&next=/reset-password",
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(response.headers.get("location")).toBe(
      "http://localhost/reset-password",
    );
  });

  it("sanitizes the requested next path before redirecting", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession, verifyOtp: vi.fn() },
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?code=auth-code&next=https://evil.example/owned",
      ),
    );

    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redirects successful otp verification to the requested next path", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });

    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession: vi.fn(), verifyOtp },
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?token_hash=hash&type=recovery&next=/reset-password",
      ),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "hash",
    });
    expect(response.headers.get("location")).toBe(
      "http://localhost/reset-password",
    );
  });

  it("redirects failed recovery links back to forgot password", async () => {
    const exchangeCodeForSession = vi
      .fn()
      .mockResolvedValue({ error: new Error("bad code") });

    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession, verifyOtp: vi.fn() },
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?code=bad-code&next=/reset-password",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/forgot-password?message=Recovery%20link%20could%20not%20be%20verified.",
    );
  });

  it("redirects failed confirmation links back to sign in", async () => {
    const exchangeCodeForSession = vi
      .fn()
      .mockResolvedValue({ error: new Error("bad code") });

    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession, verifyOtp: vi.fn() },
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/auth/confirm?code=bad-code"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/?message=Confirmation%20link%20could%20not%20be%20verified.",
    );
  });

  it("redirects to forgot password when recovery verification fails", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: new Error("bad otp") });

    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession: vi.fn(), verifyOtp },
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?token_hash=hash&type=recovery&next=/reset-password",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/forgot-password?message=Recovery%20link%20could%20not%20be%20verified.",
    );
  });

  it("keeps recovery links on reset password when the next path is unsafe", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });

    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession: vi.fn(), verifyOtp },
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?token_hash=hash&type=recovery&next=https://evil.example/owned",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/reset-password",
    );
  });

  it("falls back to the confirmation error when Supabase is unavailable", async () => {
    hasSupabaseConfigMock.mockReturnValue(false);

    const response = await GET(
      new NextRequest("http://localhost/auth/confirm?code=auth-code"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/?message=Confirmation%20link%20could%20not%20be%20verified.",
    );
  });

  it("preserves auth cookies on successful recovery redirects", async () => {
    const verifyOtp = vi.fn().mockImplementation(async () => {
      const cookies = createServerClientMock.mock.calls[0]?.[2]?.cookies as
        | {
            setAll: (
              cookiesToSet: Array<{
                name: string;
                value: string;
                options?: Record<string, unknown>;
              }>,
              headers: Record<string, string>,
            ) => void;
          }
        | undefined;

      expect(cookies).toBeDefined();

      cookies?.setAll([
        {
          name: "sb-recovery",
          value: "session-token",
          options: { httpOnly: true, path: "/" },
        },
      ], {});

      return { error: null };
    });

    createServerClientMock.mockReturnValue({
      auth: { exchangeCodeForSession: vi.fn(), verifyOtp },
    } as never);

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/confirm?token_hash=hash&type=recovery&next=/reset-password",
      ),
    );

    expect(response.cookies.get("sb-recovery")?.value).toBe("session-token");
  });
});
