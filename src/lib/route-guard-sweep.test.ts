import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const API_ROOT = path.join(process.cwd(), "src", "app", "api");
const ROUTE_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

// Routes that intentionally manage their own identity handling.
// Each entry must document why it is exempt from the route guard.
const EXEMPT_ROUTES = new Set([
  // Anonymous password sign-in: protected by the centralized same-origin proxy,
  // then establishes user identity through the Supabase SSR server client.
  "auth/sign-in/route.ts",
  // Vercel Cron pipeline coordinator: authenticated by a bearer secret, not user identity.
  "internal/pipeline-operations/run/route.ts",
  // Vercel Cron durable-run watchdog: authenticated by CRON_SECRET, not user identity.
  "internal/api-connection-runs/reconcile/route.ts",
  // Vercel Cron endpoint: authenticated by CRON_SECRET bearer token, not user identity.
  "ops/supabase-heartbeat/route.ts",
]);

function listRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return listRouteFiles(fullPath);
    }

    return entry.name === "route.ts" ? [fullPath] : [];
  });
}

describe("API route guard sweep", () => {
  const routeFiles = listRouteFiles(API_ROOT).map((fullPath) =>
    path.relative(API_ROOT, fullPath),
  );

  it("finds the API route surface", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it("keeps the exemption list accurate", () => {
    for (const exempt of EXEMPT_ROUTES) {
      expect(routeFiles).toContain(exempt);
    }
  });

  for (const routeFile of routeFiles) {
    if (EXEMPT_ROUTES.has(routeFile)) {
      continue;
    }

    describe(routeFile, () => {
      const source = readFileSync(path.join(API_ROOT, routeFile), "utf8");

      it("wraps every handler in withRoute", () => {
        expect(source).toContain('from "@/lib/route-guard"');

        for (const method of ROUTE_METHODS) {
          if (source.includes(`export const ${method} =`)) {
            expect(source).toMatch(
              new RegExp(`export const ${method} = withRoute\\(`),
            );
          }
        }

        const unwrapped = ROUTE_METHODS.filter((method) =>
          source.includes(`export async function ${method}`),
        );
        expect(unwrapped).toEqual([]);
      });

      it("does not resolve identity outside the guard", () => {
        expect(source).not.toContain("getCurrentIdentity");
      });
    });
  }
});
