import { describe, expect, it } from "vitest";

import { createVerifyChangeReport } from "./verify-change";

describe("verify-change", () => {
  it("returns a non-zero exit code for a missing route registry entry on page changes", () => {
    const report = createVerifyChangeReport({
      changedFiles: ["src/app/example/page.tsx"],
      contractIssues: [
        {
          requirement: "route-registry-entry",
          message: "Missing smoke route entry for src/app/example/page.tsx",
        },
      ],
    });

    expect(report.exitCode).toBe(1);
    expect(report.contractIssues).toHaveLength(1);
  });

  it("returns a non-zero exit code for a missing page marker on page changes", () => {
    const report = createVerifyChangeReport({
      changedFiles: ["src/app/example/page.tsx"],
      contractIssues: [
        {
          requirement: "page-marker",
          message:
            'Missing data-smoke-page="example-page" marker in src/app/example/page.tsx',
        },
      ],
    });

    expect(report.exitCode).toBe(1);
  });

  it("returns a non-zero exit code for a missing page-ready marker on page changes", () => {
    const report = createVerifyChangeReport({
      changedFiles: ["src/app/example/page.tsx"],
      contractIssues: [
        {
          requirement: "page-ready-marker",
          message:
            'Missing data-smoke-page-ready="example-page" marker in src/app/example/page.tsx',
        },
      ],
    });

    expect(report.exitCode).toBe(1);
  });

  it("returns a non-zero exit code for a missing shared UI fixture on primitive changes", () => {
    const report = createVerifyChangeReport({
      changedFiles: ["src/components/ui/button.tsx"],
      contractIssues: [
        {
          requirement: "shared-ui-fixture",
          message:
            "Missing shared UI smoke fixture src/components/ui/button.smoke.tsx",
        },
      ],
    });

    expect(report.exitCode).toBe(1);
  });

  it("includes the targeted smoke recommendation for dataset UI changes", () => {
    const report = createVerifyChangeReport({
      changedFiles: ["src/components/dashboard/dataset-edit-sheet.tsx"],
      contractIssues: [],
    });

    expect(report.targetedSmoke.mode).toBe("targeted");
    expect(report.targetedSmoke.command).toBe("pnpm run test:ui:smoke:targeted");
    expect(report.targetedSmoke.journeyTitles).toContain(
      "admin can edit dataset details",
    );
  });
});
