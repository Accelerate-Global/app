import { describe, expect, it } from "vitest";

import { buildSecurityHeaders } from "./security-headers";

function toHeaderMap(nodeEnv: string) {
  return Object.fromEntries(
    buildSecurityHeaders({
      nodeEnv,
      supabaseUrl: "https://project.supabase.co",
    }).map((header) => [header.key, header.value]),
  );
}

describe("security-headers", () => {
  it("builds a development CSP that allows the known local runtime dependencies", () => {
    const headers = toHeaderMap("development");

    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy"]).toContain("script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com");
    expect(headers["Content-Security-Policy"]).toContain(
      "style-src 'self' 'unsafe-inline' https://use.typekit.net",
    );
    expect(headers["Content-Security-Policy"]).toContain(
      "worker-src 'self' blob:",
    );
    expect(headers["Content-Security-Policy"]).toContain(
      "connect-src 'self' https://performance.typekit.net https://project.supabase.co",
    );
    expect(headers["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    );
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });

  it("tightens production headers with HSTS and upgrade-insecure-requests", () => {
    const headers = toHeaderMap("production");

    expect(headers["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
    expect(headers["Content-Security-Policy"]).not.toContain("https://va.vercel-scripts.com");
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});
