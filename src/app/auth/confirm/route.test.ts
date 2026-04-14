import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GET } from "./route";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const hasSupabaseConfigMock = vi.mocked(hasSupabaseConfig);
const createSupabaseServerClientMock = vi.mocked(createSupabaseServerClient);

describe("/auth/confirm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasSupabaseConfigMock.mockReturnValue(true);
  });

  it("redirects successful code exchanges to the requested next path", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    createSupabaseServerClientMock.mockResolvedValue({
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

  it("redirects successful otp verification to the requested next path", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });

    createSupabaseServerClientMock.mockResolvedValue({
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

    createSupabaseServerClientMock.mockResolvedValue({
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

    createSupabaseServerClientMock.mockResolvedValue({
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

    createSupabaseServerClientMock.mockResolvedValue({
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

  it("falls back to the confirmation error when Supabase is unavailable", async () => {
    hasSupabaseConfigMock.mockReturnValue(false);

    const response = await GET(
      new NextRequest("http://localhost/auth/confirm?code=auth-code"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/?message=Confirmation%20link%20could%20not%20be%20verified.",
    );
  });
});
