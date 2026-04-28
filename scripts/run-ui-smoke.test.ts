import { describe, expect, it } from "vitest";

import { hasUsableSupabaseStatusOutput } from "./lib/ui-smoke-env";
import {
  buildUiSmokeRunPlan,
  CI_UI_SMOKE_SUPABASE_START_TIMEOUT_MS,
  DEFAULT_SUPABASE_PORT_RELEASE_WAIT,
  DEFAULT_SUPABASE_STATUS_OUTPUT_RETRY,
  DEFAULT_UI_SMOKE_PROJECT_GROUP_RETRY,
  DEFAULT_UI_SMOKE_SUPABASE_START_TIMEOUT_MS,
  expandUiSmokeSuiteProjects,
  getSmokeBootstrapArgs,
  getUiSmokeSupabaseStartTimeoutMs,
  isSupabaseDbResetRetryableError,
  isSupabaseStartRetryableError,
  isUiSmokeEnvironmentFailure,
  parseRunUiSmokeArgs,
  resolveUiSmokeChangedFiles,
  UI_SMOKE_DB_RESET_ARGS,
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
        testPaths: [],
      }),
    ]);
    expect(plan.suites[0]?.projectNames).toEqual(
      expect.arrayContaining(["desktop-admin", "desktop-pro", "desktop-basic"]),
    );
    expect(plan.bootstrapScope).toBe("datasets");
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
        testPaths: [],
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
        testPaths: [],
      },
    ]);
    expect(plan.bootstrapScope).toBe("full");
  });

  it("targets a smoke spec file directly when only the journey spec changed", () => {
    const plan = buildUiSmokeRunPlan({
      changedFiles: ["tests/ui/10-journeys.spec.ts"],
      targeted: true,
      fullAfterTargeted: false,
    });

    expect(plan.suites).toEqual([
      {
        kind: "targeted",
        grepPattern: null,
        projectNames: [
          "desktop-anonymous",
          "desktop-pro",
          "desktop-basic",
          "desktop-admin",
          "mobile-anonymous",
          "mobile-pro",
          "mobile-basic",
          "mobile-admin",
        ],
        testPaths: ["tests/ui/10-journeys.spec.ts"],
      },
    ]);
    expect(plan.bootstrapScope).toBe("full");
  });

  it("adds the route sweep spec when targeted smoke mixes route ids with a journey spec file", () => {
    const plan = buildUiSmokeRunPlan({
      changedFiles: [
        "tests/ui/10-journeys.spec.ts",
        "src/components/dashboard/dataset-detail-client.tsx",
      ],
      targeted: true,
      fullAfterTargeted: false,
    });

    expect(plan.suites).toEqual([
      expect.objectContaining({
        kind: "targeted",
        testPaths: [
          "tests/ui/00-route-sweep.spec.ts",
          "tests/ui/10-journeys.spec.ts",
        ],
      }),
    ]);
    expect(plan.suites[0]?.projectNames).toEqual([
      "desktop-pro",
      "desktop-basic",
      "desktop-admin",
    ]);
  });

  it("builds a smoke-check-only targeted plan when no routes match", () => {
    const plan = buildUiSmokeRunPlan({
      changedFiles: ["src/lib/analytics.ts"],
      targeted: true,
      fullAfterTargeted: false,
    });

    expect(plan.selection?.mode).toBe("none");
    expect(plan.suites).toEqual([]);
  });

  it("passes the selected bootstrap scope through the smoke bootstrap command", () => {
    expect(getSmokeBootstrapArgs("datasets")).toEqual([
      "run",
      "smoke:bootstrap",
      "--",
      "--scope",
      "datasets",
    ]);
  });

  it("runs full smoke suites one project at a time in stable order", () => {
    expect(
      expandUiSmokeSuiteProjects({
        kind: "full",
        grepPattern: null,
        projectNames: [],
        testPaths: [],
      }),
    ).toEqual([
      ["desktop-anonymous"],
      ["desktop-pro"],
      ["desktop-basic"],
      ["desktop-admin"],
      ["mobile-anonymous"],
      ["mobile-pro"],
      ["mobile-basic"],
      ["mobile-admin"],
    ]);
  });

  it("preserves explicit targeted project selection when expanding smoke suites", () => {
    expect(
      expandUiSmokeSuiteProjects({
        kind: "targeted",
        grepPattern: "dataset-detail-admin",
        projectNames: ["desktop-admin", "mobile-admin"],
        testPaths: ["tests/ui/00-route-sweep.spec.ts"],
      }),
    ).toEqual([["desktop-admin"], ["mobile-admin"]]);
  });

  it("uses the longer Supabase port release wait by default", () => {
    expect(DEFAULT_SUPABASE_PORT_RELEASE_WAIT).toEqual({
      maxAttempts: 30,
      retryDelayMs: 2_000,
    });
  });

  it("retries incomplete Supabase status env output a bounded number of times", () => {
    expect(DEFAULT_SUPABASE_STATUS_OUTPUT_RETRY).toEqual({
      attempts: 5,
      retryDelayMs: 2_000,
    });
  });

  it("retries a failed Playwright project group once after an environment drop", () => {
    expect(DEFAULT_UI_SMOKE_PROJECT_GROUP_RETRY).toEqual({
      attempts: 2,
      retryDelayMs: 3_000,
    });
  });

  it("resets the local Supabase database without seeding smoke fixtures", () => {
    expect(UI_SMOKE_DB_RESET_ARGS).toEqual([
      "db",
      "reset",
      "--local",
      "--no-seed",
      "--yes",
    ]);
  });

  it("uses a longer Supabase startup timeout in CI", () => {
    expect(
      getUiSmokeSupabaseStartTimeoutMs({
        NODE_ENV: "test",
        CI: "true",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(CI_UI_SMOKE_SUPABASE_START_TIMEOUT_MS);
    expect(
      getUiSmokeSupabaseStartTimeoutMs({
        NODE_ENV: "test",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(DEFAULT_UI_SMOKE_SUPABASE_START_TIMEOUT_MS);
  });

  it("retries Supabase start for Docker prune and network races", () => {
    expect(
      isSupabaseStartRetryableError(
        new Error(
          "failed to prune containers: Error response from daemon: a prune operation is already running",
        ),
      ),
    ).toBe(true);
    expect(
      isSupabaseStartRetryableError(
        new Error(
          "failed to start docker container: Error response from daemon: failed to set up container networking: network supabase_network_online not found",
        ),
      ),
    ).toBe(true);
  });

  it("retries Supabase db reset when the local schema restart is temporarily out of sync", () => {
    expect(
      isSupabaseDbResetRetryableError(
        new Error(
          'Error status 400: {"statusCode":"503","error":"DatabaseSchemaMismatch","message":"The database schema is out of sync. Please run migrations or contact support."}',
        ),
      ),
    ).toBe(true);
  });

  it("recognizes local stack outages in Playwright smoke output", () => {
    expect(
      isUiSmokeEnvironmentFailure(
        new Error(
          "page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/dashboard/datasets",
        ),
      ),
    ).toBe(true);
    expect(
      isUiSmokeEnvironmentFailure(
        new Error("[WebServer] [TypeError: fetch failed] connect ECONNREFUSED 127.0.0.1:54321"),
      ),
    ).toBe(true);
    expect(
      isUiSmokeEnvironmentFailure(
        new Error(
          '[contract] Smoke route upload-admin page marker: expect(locator("[data-smoke-page=\\"upload\\"]")).toBeVisible() failed',
        ),
      ),
    ).toBe(false);
  });

  it("parses explicit base and head refs for CI-targeted smoke", () => {
    expect(
      parseRunUiSmokeArgs([
        "node",
        "scripts/run-ui-smoke.ts",
        "--targeted",
        "--base",
        "base-sha",
        "--head",
        "head-sha",
      ]),
    ).toEqual({
      headed: false,
      fullAfterTargeted: false,
      targeted: true,
      skipBuild: false,
      baseSha: "base-sha",
      headSha: "head-sha",
    });
  });

  it("parses skip-build from flags and environment", () => {
    expect(
      parseRunUiSmokeArgs(
        [
          "node",
          "scripts/run-ui-smoke.ts",
          "--targeted",
          "--skip-build",
        ],
        {} as NodeJS.ProcessEnv,
      ),
    ).toEqual({
      headed: false,
      fullAfterTargeted: false,
      targeted: true,
      skipBuild: true,
      baseSha: null,
      headSha: null,
    });

    expect(
      parseRunUiSmokeArgs(
        ["node", "scripts/run-ui-smoke.ts"],
        {
          UI_SMOKE_SKIP_BUILD: "1",
        } as unknown as NodeJS.ProcessEnv,
      ),
    ).toEqual({
      headed: false,
      fullAfterTargeted: false,
      targeted: false,
      skipBuild: true,
      baseSha: null,
      headSha: null,
    });
  });

  it("prefers git diff files when CI refs are provided", () => {
    expect(
      resolveUiSmokeChangedFiles({
        targeted: true,
        baseSha: "base-sha",
        headSha: "head-sha",
        diffFiles: ["src/components/dashboard/dataset-edit-page-client.tsx"],
        statusFiles: ["src/components/dashboard/dataset-table.tsx"],
      }),
    ).toEqual(["src/components/dashboard/dataset-edit-page-client.tsx"]);
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

    expect(
      hasUsableSupabaseStatusOutput(`
export API_URL="http://127.0.0.1:54321"
export DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
export PUBLISHABLE_KEY="sb_publishable_test"
export SERVICE_ROLE_KEY="service-role"
      `),
    ).toBe(true);
  });
});
