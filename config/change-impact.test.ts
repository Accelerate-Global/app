import { describe, expect, it } from "vitest";

import { resolveChangeImpact } from "./change-impact";

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
});
