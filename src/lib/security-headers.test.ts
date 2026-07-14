import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  createCspNonce,
} from "./security-headers";

function toHeaderMap(nodeEnv: string) {
  return Object.fromEntries(
    buildSecurityHeaders({
      nodeEnv,
    }).map((header) => [header.key, header.value]),
  );
}

describe("security-headers", () => {
  it("builds static development security headers without a reusable CSP", () => {
    const headers = toHeaderMap("development");

    expect(headers).not.toHaveProperty("Content-Security-Policy");
    expect(headers["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    );
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });

  it("tightens production headers with HSTS and upgrade-insecure-requests", () => {
    const headers = toHeaderMap("production");

    expect(headers).not.toHaveProperty("Content-Security-Policy");
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("builds a production nonce CSP without unsafe-inline scripts or analytics", () => {
    const policy = buildContentSecurityPolicy({
      nodeEnv: "production",
      nonce: "nonce123",
      supabaseUrl: "https://project.supabase.co/path",
    });

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain(
      "script-src 'self' 'nonce-nonce123' 'strict-dynamic'",
    );
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("va.vercel-scripts.com");
    expect(policy).toContain(
      "connect-src 'self' https://performance.typekit.net https://project.supabase.co",
    );
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows unsafe-eval only for the development runtime", () => {
    const development = buildContentSecurityPolicy({
      nodeEnv: "development",
      nonce: "nonce123",
    });
    const production = buildContentSecurityPolicy({
      nodeEnv: "production",
      nonce: "nonce123",
    });

    expect(development).toContain("'unsafe-eval'");
    expect(production).not.toContain("'unsafe-eval'");
  });

  it("generates unique base64-compatible nonces and rejects directive injection", () => {
    const first = createCspNonce();
    const second = createCspNonce();

    expect(first).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
    expect(second).not.toBe(first);
    expect(() =>
      buildContentSecurityPolicy({
        nodeEnv: "production",
        nonce: "bad'; script-src *",
      }),
    ).toThrow(/base64-compatible/);
  });
});
