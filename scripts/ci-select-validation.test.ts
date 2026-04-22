import { describe, expect, it } from "vitest";

import { selectCiValidation } from "./ci-select-validation";

describe("ci-select-validation", () => {
  it("selects targeted UI smoke and browser setup for dataset UI changes", () => {
    const selection = selectCiValidation([
      "src/components/dashboard/dataset-edit-page-client.tsx",
    ]);

    expect(selection.appQuality).toBe(true);
    expect(selection.appLint).toBe(true);
    expect(selection.appTest).toBe(true);
    expect(selection.appBuild).toBe(true);
    expect(selection.databaseSecurity).toBe(false);
    expect(selection.uiSmoke).toBe(true);
    expect(selection.uiSmokeMode).toBe("targeted");
    expect(selection.uiSmokeBrowser).toBe(true);
  });

  it("selects full UI smoke for harness changes", () => {
    const selection = selectCiValidation(["tests/ui/support/smoke-helpers.ts"]);

    expect(selection.uiSmokeMode).toBe("full");
    expect(selection.uiSmokeBrowser).toBe(true);
  });

  it("selects database security for migration changes", () => {
    const selection = selectCiValidation([
      "supabase/migrations/20260415172837_add_field_definition_viewer_visibility.sql",
    ]);

    expect(selection.databaseSecurity).toBe(true);
  });

  it("selects dependency audit for package manifest changes", () => {
    const selection = selectCiValidation(["package.json", "pnpm-lock.yaml"]);

    expect(selection.dependencyAudit).toBe(true);
  });

  it("skips CI validation suites for docs-only changes", () => {
    const selection = selectCiValidation(["docs/release.md"]);

    expect(selection.appQuality).toBe(false);
    expect(selection.appLint).toBe(false);
    expect(selection.appTest).toBe(false);
    expect(selection.appBuild).toBe(false);
    expect(selection.databaseSecurity).toBe(false);
    expect(selection.dependencyAudit).toBe(false);
    expect(selection.uiSmokeMode).toBe("none");
    expect(selection.uiSmokeBrowser).toBe(false);
  });

  it("keeps build off for script-only changes", () => {
    const selection = selectCiValidation(["scripts/ship.ts"]);

    expect(selection.appQuality).toBe(true);
    expect(selection.appLint).toBe(true);
    expect(selection.appTest).toBe(true);
    expect(selection.appBuild).toBe(false);
  });

  it("keeps build off for test-only changes", () => {
    const selection = selectCiValidation(["scripts/ci-select-validation.test.ts"]);

    expect(selection.appQuality).toBe(true);
    expect(selection.appLint).toBe(true);
    expect(selection.appTest).toBe(true);
    expect(selection.appBuild).toBe(false);
  });

  it("runs app quality without build for shared workflow bootstrap action changes", () => {
    const selection = selectCiValidation([".github/actions/setup-pnpm-node/action.yml"]);

    expect(selection.appQuality).toBe(true);
    expect(selection.appLint).toBe(true);
    expect(selection.appTest).toBe(true);
    expect(selection.appBuild).toBe(false);
  });
});
