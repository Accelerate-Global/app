import { describe, expect, it } from "vitest";

import { resolveUiSmokeSelection } from "./ui-smoke-selection";

describe("ui-smoke-selection", () => {
  it("targets dataset routes and admin journey for dataset UI changes", () => {
    const selection = resolveUiSmokeSelection([
      "src/components/dashboard/dataset-edit-sheet.tsx",
    ]);

    expect(selection.mode).toBe("targeted");
    expect(selection.routeIds).toEqual(
      expect.arrayContaining([
        "dashboard-viewer",
        "dashboard-admin",
        "dataset-detail-viewer",
        "dataset-detail-admin",
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
});
