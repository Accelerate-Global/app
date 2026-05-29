import { beforeEach, describe, expect, it, vi } from "vitest";

import { setProxiedIdentityHeaders } from "@/lib/auth-identity-headers";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { getCurrentIdentity } from "./auth";

const { cookiesMock, headersMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  headersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

const hasSupabaseConfigMock = vi.mocked(hasSupabaseConfig);
const createSupabaseServerClientMock = vi.mocked(createSupabaseServerClient);

describe("getCurrentIdentity", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasSupabaseConfigMock.mockReturnValue(true);
    headersMock.mockResolvedValue(new Headers());
    cookiesMock.mockResolvedValue({});
  });

  it("uses proxy-verified identity headers without creating a Supabase client", async () => {
    const requestHeaders = new Headers();
    setProxiedIdentityHeaders(requestHeaders, {
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Blake Lewis",
      workspaceRole: "admin",
    });
    headersMock.mockResolvedValue(requestHeaders);

    await expect(getCurrentIdentity()).resolves.toEqual({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Blake Lewis",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    expect(cookiesMock).not.toHaveBeenCalled();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("falls back to Supabase user lookup when proxy identity is absent", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "owner-2",
              email: "reader@example.com",
              app_metadata: {
                workspace_role: "basic",
              },
              user_metadata: {
                full_name: " Reader ",
              },
            },
          },
        })),
      },
    } as never);

    await expect(getCurrentIdentity()).resolves.toEqual({
      ownerId: "owner-2",
      email: "reader@example.com",
      fullName: "Reader",
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });
    expect(cookiesMock).toHaveBeenCalled();
    expect(createSupabaseServerClientMock).toHaveBeenCalled();
  });

  it("returns null when Supabase config is unavailable", async () => {
    hasSupabaseConfigMock.mockReturnValue(false);

    await expect(getCurrentIdentity()).resolves.toBeNull();
    expect(headersMock).not.toHaveBeenCalled();
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });
});
