import { describe, expect, it } from "vitest";

import {
  buildUiSmokeGrepPattern,
  formatUiSmokeZeroMatchMessage,
  resolveUiSmokeSelection,
} from "./ui-smoke-selection";

describe("ui-smoke-selection", () => {
  it("targets dataset edit routes without unrelated dataset journeys", () => {
    const selection = resolveUiSmokeSelection([
      "src/components/dashboard/dataset-edit-page-client.tsx",
    ]);

    expect(selection.mode).toBe("targeted");
    expect(selection.routeIds).toEqual([
      "dataset-edit-pro-redirect",
      "dataset-edit-basic-redirect",
      "dataset-edit-admin",
    ]);
    expect(selection.journeyTitles).toEqual(["admin can edit dataset details"]);
    expect(selection.journeyTitles).not.toContain(
      "authenticated user can save a filtered table",
    );
    expect(selection.projectNames).toEqual([
      "desktop-pro",
      "desktop-basic",
      "desktop-admin",
    ]);
    expect(selection.bootstrapScope).toBe("datasets");
  });

  it("returns no targeted browser smoke for migration-only changes", () => {
    const selection = resolveUiSmokeSelection([
      "supabase/migrations/20260415172837_add_field_definition_viewer_visibility.sql",
    ]);

    expect(selection.mode).toBe("none");
    expect(selection.command).toBeNull();
  });

  it("requires the full suite when the smoke harness changes", () => {
    const selection = resolveUiSmokeSelection(["tests/ui/support/smoke-helpers.ts"]);

    expect(selection.mode).toBe("full");
    expect(selection.command).toBe("pnpm run test:ui:smoke");
    expect(selection.summary[0]).toContain("Full suite required");
  });

  it("keeps explicitly global support files on the full suite path", () => {
    const selection = resolveUiSmokeSelection(["tests/ui/support/project-context.ts"]);

    expect(selection.mode).toBe("full");
    expect(selection.command).toBe("pnpm run test:ui:smoke");
    expect(selection.summary[0]).toContain("Full suite required");
  });

  it("targets field sources routes and journey for field source changes", () => {
    const selection = resolveUiSmokeSelection([
      "src/components/dashboard/field-sources-client.tsx",
    ]);

    expect(selection.mode).toBe("targeted");
    expect(selection.routeIds).toContain("field-sources-admin");
    expect(selection.journeyTitles).toContain(
      "admin can review field source mappings",
    );
    expect(selection.projectNames).toEqual([
      "desktop-pro",
      "desktop-basic",
      "desktop-admin",
    ]);
    expect(selection.bootstrapScope).toBe("admin-config");
  });

  it("targets only the dataset detail routes for detail page changes", () => {
    const selection = resolveUiSmokeSelection([
      "src/components/dashboard/dataset-detail-client.tsx",
    ]);

    expect(selection.routeIds).toEqual([
      "dataset-detail-pro",
      "dataset-detail-basic",
      "dataset-detail-admin",
    ]);
    expect(selection.journeyTitles).toEqual([
      "basic user can filter and download without saving",
    ]);
    expect(selection.projectNames).toEqual([
      "desktop-pro",
      "desktop-basic",
      "desktop-admin",
    ]);
    expect(selection.bootstrapScope).toBe("datasets");
  });

  it("includes mobile smoke coverage for shared UI primitive changes", () => {
    const selection = resolveUiSmokeSelection(["src/components/ui/button.tsx"]);

    expect(selection.routeIds).toEqual(["smoke-components-anonymous"]);
    expect(selection.projectNames).toEqual([
      "desktop-anonymous",
      "mobile-anonymous",
    ]);
    expect(selection.testPaths).toEqual([]);
    expect(selection.bootstrapScope).toBe("auth");
  });

  it("targets the edited journeys spec directly without forcing the full suite", () => {
    const selection = resolveUiSmokeSelection(["tests/ui/10-journeys.spec.ts"]);

    expect(selection.mode).toBe("targeted");
    expect(selection.routeIds).toEqual([]);
    expect(selection.journeyTitles).toEqual([]);
    expect(selection.testPaths).toEqual(["tests/ui/10-journeys.spec.ts"]);
    expect(selection.projectNames).toEqual([
      "desktop-anonymous",
      "desktop-pro",
      "desktop-basic",
      "desktop-admin",
      "mobile-anonymous",
      "mobile-pro",
      "mobile-basic",
      "mobile-admin",
    ]);
    expect(selection.bootstrapScope).toBe("full");
  });

  it("reuses product-selected projects when a journeys spec changes alongside app code", () => {
    const selection = resolveUiSmokeSelection([
      "tests/ui/10-journeys.spec.ts",
      "src/components/dashboard/dataset-edit-page-client.tsx",
    ]);

    expect(selection.mode).toBe("targeted");
    expect(selection.testPaths).toEqual(["tests/ui/10-journeys.spec.ts"]);
    expect(selection.projectNames).toEqual([
      "desktop-pro",
      "desktop-basic",
      "desktop-admin",
    ]);
    expect(selection.routeIds).toEqual([
      "dataset-edit-pro-redirect",
      "dataset-edit-basic-redirect",
      "dataset-edit-admin",
    ]);
    expect(selection.bootstrapScope).toBe("full");
  });

  it("builds a grep pattern that matches Playwright full titles", () => {
    const selection = resolveUiSmokeSelection([
      "src/components/dashboard/field-sources-client.tsx",
    ]);
    const grepPattern = buildUiSmokeGrepPattern(selection);

    expect(grepPattern).toBeTruthy();

    const matcher = new RegExp(grepPattern ?? "");
    expect(
      matcher.test("tests/ui/00-route-sweep.spec.ts field-sources-admin"),
    ).toBe(true);
    expect(
      matcher.test(
        "tests/ui/10-journeys.spec.ts admin can review field source mappings",
      ),
    ).toBe(true);
  });

  it("formats a blocking zero-match validation error for targeted smoke", () => {
    const selection = resolveUiSmokeSelection([
      "src/components/dashboard/field-sources-client.tsx",
    ]);
    const grepPattern = buildUiSmokeGrepPattern(selection);
    const message = formatUiSmokeZeroMatchMessage({
      selection,
      grepPattern: grepPattern ?? "",
    });

    expect(message).toContain("matched zero Playwright tests");
    expect(message).toContain("field-sources-admin");
    expect(message).toContain("admin can review field source mappings");
  });

  it("includes direct test files in zero-match validation errors", () => {
    const selection = resolveUiSmokeSelection(["tests/ui/10-journeys.spec.ts"]);
    const message = formatUiSmokeZeroMatchMessage({
      selection,
      grepPattern: "",
    });

    expect(message).toContain("Test files: tests/ui/10-journeys.spec.ts");
    expect(message).not.toContain("Grep pattern:");
  });
});
