import { describe, expect, it } from "vitest";

import {
  clearProxiedIdentityHeaders,
  proxiedIdentityHeaderNames,
  readProxiedIdentityHeaders,
  setProxiedIdentityHeaders,
} from "@/lib/auth-identity-headers";

describe("auth identity headers", () => {
  it("round-trips nullable proxied identity fields", () => {
    const headers = new Headers();

    setProxiedIdentityHeaders(headers, {
      ownerId: "owner-1",
      email: "member@example.com",
      fullName: "Member Example",
      workspaceRole: "admin",
    });

    expect(readProxiedIdentityHeaders(headers)).toEqual({
      ownerId: "owner-1",
      email: "member@example.com",
      fullName: "Member Example",
      workspaceRole: "admin",
    });
  });

  it("clears spoofable internal header names", () => {
    const headers = new Headers();

    proxiedIdentityHeaderNames.forEach((name) => {
      headers.set(name, "spoofed");
    });

    clearProxiedIdentityHeaders(headers);

    proxiedIdentityHeaderNames.forEach((name) => {
      expect(headers.has(name)).toBe(false);
    });
  });

  it("rejects invalid proxied role data", () => {
    const headers = new Headers({
      "x-ag-internal-auth-owner-id": "owner-1",
      "x-ag-internal-auth-workspace-role": "root",
    });

    expect(readProxiedIdentityHeaders(headers)).toBeNull();
  });
});
