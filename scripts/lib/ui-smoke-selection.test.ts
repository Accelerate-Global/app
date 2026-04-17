import { describe, expect, it } from "vitest";

import {
  buildUiSmokeGrepPattern,
  formatUiSmokeZeroMatchMessage,
  resolveUiSmokeSelection,
} from "./ui-smoke-selection";

describe("ui-smoke-selection", () => {
  it("targets dataset routes and admin journey for dataset UI changes", () => {
    const selection = resolveUiSmokeSelection([
      "src/components/dashboard/dataset-edit-page-client.tsx",
    ]);

    expect(selection.mode).toBe("targeted");
    expect(selection.routeIds).toEqual(
      expect.arrayContaining([
        "dashboard-viewer",
        "dashboard-admin",
        "dataset-detail-viewer",
        "dataset-detail-admin",
        "dataset-edit-viewer-redirect",
        "dataset-edit-admin",
      ]),
    );
    expect(selection.journeyTitles).toContain("admin can edit dataset details");
    expect(selection.projectNames).toEqual(
      expect.arrayContaining([
        "desktop-viewer",
        "mobile-viewer",
        "desktop-admin",
        "mobile-admin",
      ]),
    );
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

  it("targets field sources routes and journey for field source changes", () => {
    const selection = resolveUiSmokeSelection([
      "src/components/dashboard/field-sources-client.tsx",
    ]);

    expect(selection.mode).toBe("targeted");
    expect(selection.routeIds).toContain("field-sources-admin");
    expect(selection.journeyTitles).toContain(
      "admin can create a source column and update a field source value",
    );
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
        "tests/ui/10-journeys.spec.ts admin can create a source column and update a field source value",
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
    expect(message).toContain(
      "admin can create a source column and update a field source value",
    );
  });
});
