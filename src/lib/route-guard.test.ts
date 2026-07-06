import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { withRoute } from "@/lib/route-guard";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const logErrorMock = vi.mocked(logError);

function createIdentity(overrides: { isDatasetAdmin?: boolean } = {}) {
  return {
    ownerId: "owner-1",
    email: "user@example.com",
    fullName: null,
    workspaceRole: overrides.isDatasetAdmin
      ? ("admin" as const)
      : ("basic" as const),
    isDatasetAdmin: overrides.isDatasetAdmin ?? false,
    mode: "supabase" as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withRoute", () => {
  it("returns 401 when no identity is resolved", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);
    const handler = vi.fn();
    const route = withRoute({ access: "user" }, handler);

    const response = await route();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized." });
    expect(handler).not.toHaveBeenCalled();
  });

  it("normalizes identity resolution errors to a 500 response", async () => {
    getCurrentIdentityMock.mockRejectedValue(new Error("identity unavailable"));
    const handler = vi.fn();
    const route = withRoute({ access: "user" }, handler);

    const response = await route();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Request failed." });
    expect(handler).not.toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledWith(
      "Unhandled API route error",
      expect.any(Error),
    );
  });

  it("returns the admin-only error for non-admin users on admin routes", async () => {
    getCurrentIdentityMock.mockResolvedValue(createIdentity());
    const handler = vi.fn();
    const route = withRoute(
      { access: "admin", action: "manage users" },
      handler,
    );

    const response = await route();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Only admins can manage users.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the identity and original arguments to the handler", async () => {
    const identity = createIdentity({ isDatasetAdmin: true });
    getCurrentIdentityMock.mockResolvedValue(identity);
    const handler = vi.fn(async (identityArg: unknown, requestArg: Request) => {
      void identityArg;
      void requestArg;
      return Response.json({ ok: true });
    });
    const route = withRoute(
      { access: "admin", action: "manage users" },
      handler,
    );
    const request = new Request("https://example.com/api/admin/users");

    const response = await route(request);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(identity, request);
  });

  it("normalizes unhandled handler errors to a 500 response", async () => {
    getCurrentIdentityMock.mockResolvedValue(createIdentity());
    const route = withRoute({ access: "user" }, async () => {
      throw new Error("boom");
    });

    const response = await route();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Request failed." });
    expect(logErrorMock).toHaveBeenCalledWith(
      "Unhandled API route error",
      expect.any(Error),
    );
  });
});
