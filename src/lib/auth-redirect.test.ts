import { describe, expect, it } from "vitest";

import {
  buildAuthConfirmUrl,
  DEFAULT_AUTH_REDIRECT_PATH,
  sanitizeAuthRedirectPath,
} from "./auth-redirect";

describe("sanitizeAuthRedirectPath", () => {
  it("allows in-app relative paths", () => {
    expect(sanitizeAuthRedirectPath("/dashboard/profile?tab=security#email")).toBe(
      "/dashboard/profile?tab=security#email",
    );
  });

  it("falls back for external or protocol-relative values", () => {
    expect(sanitizeAuthRedirectPath("https://evil.example/owned")).toBe(
      DEFAULT_AUTH_REDIRECT_PATH,
    );
    expect(sanitizeAuthRedirectPath("//evil.example/owned")).toBe(
      DEFAULT_AUTH_REDIRECT_PATH,
    );
  });

  it("uses the provided fallback for invalid values", () => {
    expect(sanitizeAuthRedirectPath("not-a-path", "/reset-password")).toBe(
      "/reset-password",
    );
  });
});

describe("buildAuthConfirmUrl", () => {
  it("builds a confirm URL with a sanitized next path", () => {
    expect(
      buildAuthConfirmUrl(
        "https://data.accelerateglobal.org",
        "https://evil.example/owned",
      ),
    ).toBe("https://data.accelerateglobal.org/auth/confirm?next=%2Fdashboard");
  });
});
