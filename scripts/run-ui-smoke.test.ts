import { describe, expect, it } from "vitest";

import { hasUsableSupabaseStatusOutput } from "./lib/ui-smoke-env";
import {
  buildUiSmokeRunPlan,
  DEFAULT_SUPABASE_PORT_RELEASE_WAIT,
} from "./run-ui-smoke";

describe("run-ui-smoke", () => {
  it("builds a targeted-only run plan when requested", () => {
    const plan = buildUiSmokeRunPlan({
      changedFiles: ["src/components/dashboard/dataset-edit-page-client.tsx"],
      targeted: true,
      fullAfterTargeted: false,
    });

    expect(plan.suites).toEqual([
      expect.objectContaining({
        kind: "targeted",
      }),
    ]);
    expect(plan.suites[0]?.projectNames).toEqual(
      expect.arrayContaining(["desktop-admin", "desktop-viewer"]),
    );
  });

  it("builds a full-only run plan by default", () => {
    const plan = buildUiSmokeRunPlan({
      changedFiles: [],
      targeted: false,
      fullAfterTargeted: false,
    });

    expect(plan.suites).toEqual([
      {
        kind: "full",
        grepPattern: null,
        projectNames: [],
      },
    ]);
  });

  it("builds a targeted-and-full plan that reuses the same setup", () => {
    const plan = buildUiSmokeRunPlan({
      changedFiles: ["src/components/dashboard/dataset-edit-page-client.tsx"],
      targeted: true,
      fullAfterTargeted: true,
    });

    expect(plan.suites).toEqual([
      expect.objectContaining({ kind: "targeted" }),
      {
        kind: "full",
        grepPattern: null,
        projectNames: [],
      },
    ]);
  });

  it("uses the longer Supabase port release wait by default", () => {
    expect(DEFAULT_SUPABASE_PORT_RELEASE_WAIT).toEqual({
      maxAttempts: 30,
      retryDelayMs: 2_000,
    });
  });

  it("recognizes usable local Supabase status output", () => {
    expect(
      hasUsableSupabaseStatusOutput(`
API_URL="http://127.0.0.1:54321"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PUBLISHABLE_KEY="sb_publishable_test"
SECRET_KEY="sb_secret_test"
      `),
    ).toBe(true);

    expect(
      hasUsableSupabaseStatusOutput(`
API_URL="http://127.0.0.1:54321"
PUBLISHABLE_KEY="sb_publishable_test"
      `),
    ).toBe(false);
  });
});
