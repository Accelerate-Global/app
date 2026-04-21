import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  getEffectiveRequestOrigin,
  isProtectedMutationRequest,
  validateMutationOrigin,
} from "./request-security";

describe("request-security", () => {
  it("protects mutating /api requests", () => {
    expect(
      isProtectedMutationRequest(
        new NextRequest("http://localhost/api/account/disable", {
          method: "POST",
        }),
      ),
    ).toBe(true);
    expect(
      isProtectedMutationRequest(
        new NextRequest("http://localhost/api/admin/users", {
          method: "PATCH",
        }),
      ),
    ).toBe(true);
    expect(
      isProtectedMutationRequest(
        new NextRequest("http://localhost/api/datasets", {
          method: "DELETE",
        }),
      ),
    ).toBe(true);
  });

  it("also protects sign-out and ignores unrelated requests", () => {
    expect(
      isProtectedMutationRequest(
        new NextRequest("http://localhost/auth/sign-out", {
          method: "POST",
        }),
      ),
    ).toBe(true);
    expect(
      isProtectedMutationRequest(
        new NextRequest("http://localhost/api/datasets", {
          method: "GET",
        }),
      ),
    ).toBe(false);
    expect(
      isProtectedMutationRequest(
        new NextRequest("http://localhost/dashboard", {
          method: "POST",
        }),
      ),
    ).toBe(false);
  });

  it("accepts same-origin api mutations", () => {
    const request = new NextRequest("https://data.accelerateglobal.org/api/admin/users", {
      method: "POST",
      headers: {
        origin: "https://data.accelerateglobal.org",
      },
    });

    expect(validateMutationOrigin(request)).toEqual({ ok: true });
  });

  it("rejects protected mutations without an origin header", () => {
    const request = new NextRequest("https://data.accelerateglobal.org/api/account/disable", {
      method: "POST",
    });

    expect(validateMutationOrigin(request)).toEqual({
      ok: false,
      reason: "missing-origin",
      expectedOrigin: "https://data.accelerateglobal.org",
      receivedOrigin: null,
    });
  });

  it("rejects cross-origin protected mutations", () => {
    const request = new NextRequest("https://data.accelerateglobal.org/api/datasets", {
      method: "DELETE",
      headers: {
        origin: "https://evil.example",
      },
    });

    expect(validateMutationOrigin(request)).toEqual({
      ok: false,
      reason: "origin-mismatch",
      expectedOrigin: "https://data.accelerateglobal.org",
      receivedOrigin: "https://evil.example",
    });
  });

  it("accepts same-origin sign-out requests", () => {
    const request = new NextRequest("https://data.accelerateglobal.org/auth/sign-out", {
      method: "POST",
      headers: {
        origin: "https://data.accelerateglobal.org",
      },
    });

    expect(validateMutationOrigin(request)).toEqual({ ok: true });
  });

  it("prefers forwarded host and proto when resolving the effective origin", () => {
    const request = new NextRequest("http://internal-host/api/admin/users", {
      method: "POST",
      headers: {
        origin: "https://data.accelerateglobal.org",
        "x-forwarded-host": "data.accelerateglobal.org",
        "x-forwarded-proto": "https",
      },
    });

    expect(getEffectiveRequestOrigin(request)).toBe("https://data.accelerateglobal.org");
    expect(validateMutationOrigin(request)).toEqual({ ok: true });
  });
});
