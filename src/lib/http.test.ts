import { describe, expect, it } from "vitest";

import { applyPrivateNoStoreHeaders } from "@/lib/http";

describe("applyPrivateNoStoreHeaders", () => {
  it("adds private no-store and credential variance headers", async () => {
    const response = applyPrivateNoStoreHeaders(
      Response.json({ sensitive: true }, { headers: { Vary: "Accept-Encoding" } }),
    );

    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("Expires")).toBe("0");
    expect(response.headers.get("Vary")).toBe(
      "Accept-Encoding, Cookie, Authorization",
    );
    expect(await response.json()).toEqual({ sensitive: true });
  });

  it("preserves status, redirects, and existing headers without duplicate vary values", () => {
    const response = applyPrivateNoStoreHeaders(
      new Response(null, {
        status: 302,
        headers: {
          Location: "/sign-in",
          Vary: "cookie, AUTHORIZATION",
          "X-Custom": "preserved",
        },
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/sign-in");
    expect(response.headers.get("X-Custom")).toBe("preserved");
    expect(response.headers.get("Vary")).toBe("Cookie, Authorization");
  });

  it("preserves attachment response metadata", async () => {
    const response = applyPrivateNoStoreHeaders(
      new Response("private export", {
        headers: {
          "Content-Disposition": 'attachment; filename="export.csv"',
          "Content-Type": "text/csv",
        },
      }),
    );

    expect(response.headers.get("Content-Disposition")).toContain("export.csv");
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(await response.text()).toBe("private export");
  });
});
