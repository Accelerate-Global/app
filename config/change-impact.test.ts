import { describe, expect, it } from "vitest";

import {
  resolveChangeImpact,
  selectCiAppQualityTasks,
  selectCiPreinstallValidation,
  shouldRunAppQualityOnCi,
  verificationCommandCatalog,
} from "./change-impact";

describe("change-impact", () => {
  it("requires smoke:check for shared UI primitive changes", () => {
    const impact = resolveChangeImpact(["src/components/ui/button.tsx"]);

    expect(impact.requiredCommands).toContain("smoke:check");
    expect(impact.requiredCommands).toContain("test:ui:smoke:targeted");
  });

  it("requires the full smoke suite for harness changes", () => {
    const impact = resolveChangeImpact(["tests/ui/support/smoke-helpers.ts"]);

    expect(impact.requiredCommands).toContain("test:ui:smoke");
  });

  it("keeps smoke contract checker changes on the smoke:check path", () => {
    const impact = resolveChangeImpact(["scripts/check-ui-smoke.ts"]);

    expect(impact.requiredCommands).toContain("smoke:check");
    expect(impact.requiredCommands).not.toContain("test:ui:smoke");
  });

  it("targets route sweep specs with targeted smoke instead of the full suite", () => {
    const impact = resolveChangeImpact(["tests/ui/00-route-sweep.spec.ts"]);

    expect(impact.requiredCommands).toEqual(
      expect.arrayContaining(["smoke:check", "test:ui:smoke:targeted"]),
    );
    expect(impact.requiredCommands).not.toContain("test:ui:smoke");
  });

  it("requires verify:test-delta for directly tested repo code domains", () => {
    const impact = resolveChangeImpact(["src/lib/field-sources.ts"]);

    expect(impact.requiredCommands).toContain("verify:test-delta");
  });

  it("targets the standalone dataset edit smoke routes for dataset flow changes", () => {
    const impact = resolveChangeImpact([
      "src/app/dashboard/datasets/[datasetId]/edit/page.tsx",
      "src/components/dashboard/dataset-edit-page-client.tsx",
    ]);

    expect(impact.requiredCommands).toEqual(
      expect.arrayContaining([
        "typecheck",
        "verify:test-delta",
        "verify:app",
        "smoke:check",
        "test:ui:smoke:targeted",
      ]),
    );
  });

  it("requires database security and drift checks for migration changes", () => {
    const impact = resolveChangeImpact([
      "supabase/migrations/20260415172837_add_field_definition_viewer_visibility.sql",
    ]);

    expect(impact.requiredCommands).toEqual(
      expect.arrayContaining(["db:security", "db:check-migration-drift"]),
    );
    expect(impact.manualSteps).toContain("db:push:remote");
  });

  it("returns no required commands for a clean worktree", () => {
    const impact = resolveChangeImpact([]);

    expect(impact.requiredCommands).toEqual([]);
    expect(impact.manualSteps).toEqual([]);
    expect(impact.domains).toEqual([]);
  });

  it("runs app quality on CI for workflow changes", () => {
    expect(shouldRunAppQualityOnCi([".github/workflows/ui-smoke.yml"])).toBe(true);
  });

  it("runs app quality on CI for shared workflow bootstrap action changes", () => {
    expect(shouldRunAppQualityOnCi([".github/actions/setup-pnpm-node/action.yml"])).toBe(true);
  });

  it("skips app quality on CI for docs-only changes", () => {
    expect(shouldRunAppQualityOnCi(["docs/testing/ui-smoke.md"])).toBe(false);
  });

  it("skips all preinstall workflows for docs-only changes", () => {
    expect(selectCiPreinstallValidation(["docs/testing/ui-smoke.md"])).toEqual({
      runAppQuality: false,
      runUiSmoke: false,
      runDatabaseSecurity: false,
      runDependencyAudit: false,
    });
  });

  it("selects lint and test without build for script-only changes", () => {
    expect(selectCiAppQualityTasks(["scripts/ship.ts"])).toEqual({
      lint: true,
      test: true,
      build: false,
    });
  });

  it("requires planner-policy verification for workflow bootstrap policy changes", () => {
    const impact = resolveChangeImpact(["scripts/check-workflow-bootstrap.mjs"]);

    expect(impact.requiredCommands).toEqual(
      expect.arrayContaining(["typecheck", "verify:test-delta"]),
    );
  });

  it("selects lint and test without build for test-only changes", () => {
    expect(selectCiAppQualityTasks(["scripts/ci-select-validation.test.ts"])).toEqual({
      lint: true,
      test: true,
      build: false,
    });
  });

  it("selects build for app runtime changes", () => {
    expect(selectCiAppQualityTasks(["src/components/dashboard/dataset-detail-client.tsx"]))
      .toEqual({
        lint: true,
        test: true,
        build: true,
      });
  });

  it("tracks which verification commands own the local Supabase lifecycle", () => {
    expect(verificationCommandCatalog["test:ui:smoke"].supabaseLifecycle).toBe(
      "runner-managed",
    );
    expect(verificationCommandCatalog["db:security"].supabaseLifecycle).toBe(
      "self-managed",
    );
    expect(verificationCommandCatalog["verify:ship:local"].supabaseLifecycle).toBe(
      "none",
    );
  });
});
