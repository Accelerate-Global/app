import { describe, expect, it } from "vitest";

import { selectCiValidation } from "./ci-select-validation";

describe("ci-select-validation", () => {
  it("selects targeted UI smoke and browser setup for dataset UI changes", () => {
    const selection = selectCiValidation([
      "src/components/dashboard/dataset-edit-page-client.tsx",
    ]);

    expect(selection.appQuality).toBe(true);
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
    expect(selection.databaseSecurity).toBe(false);
    expect(selection.dependencyAudit).toBe(false);
    expect(selection.uiSmokeMode).toBe("none");
    expect(selection.uiSmokeBrowser).toBe(false);
  });
});
