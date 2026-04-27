import { describe, expect, it } from "vitest";

import { createVerifyChangeReport } from "./verify-change";

const passingTestDelta = {
  changedFiles: [],
  changedTestFiles: [],
  coveredSourceFiles: [],
  mappings: [],
  missingTestUpdates: [],
  exitCode: 0 as const,
};

describe("verify-change", () => {
  it("requires OpenSpec validation for every non-empty change set", () => {
    const report = createVerifyChangeReport({
      changedFiles: ["docs/release.md"],
      contractIssues: [],
      testDelta: passingTestDelta,
    });

    expect(report.requiredCommands).toEqual(["spec:validate"]);
  });

  it("returns a non-zero exit code for a missing route registry entry on page changes", () => {
    const report = createVerifyChangeReport({
      changedFiles: ["src/app/example/page.tsx"],
      contractIssues: [
        {
          requirement: "route-registry-entry",
          message: "Missing smoke route entry for src/app/example/page.tsx",
        },
      ],
      testDelta: passingTestDelta,
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
      testDelta: passingTestDelta,
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
      testDelta: passingTestDelta,
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
      testDelta: passingTestDelta,
    });

    expect(report.exitCode).toBe(1);
  });

  it("returns a non-zero exit code for a missing direct test delta", () => {
    const report = createVerifyChangeReport({
      changedFiles: ["src/lib/field-sources.ts"],
      contractIssues: [],
      testDelta: {
        changedFiles: ["src/lib/field-sources.ts"],
        changedTestFiles: [],
        coveredSourceFiles: ["src/lib/field-sources.ts"],
        mappings: [
          {
            sourcePath: "src/lib/field-sources.ts",
            candidateTestPaths: ["src/lib/field-sources.test.ts"],
            changedTestPaths: [],
          },
        ],
        missingTestUpdates: [
          {
            sourcePath: "src/lib/field-sources.ts",
            candidateTestPaths: ["src/lib/field-sources.test.ts"],
            changedTestPaths: [],
          },
        ],
        exitCode: 1,
      },
    });

    expect(report.exitCode).toBe(1);
    expect(report.testDelta.missingTestUpdates).toHaveLength(1);
  });

  it("includes required targeted smoke and test delta for dataset UI changes", () => {
    const report = createVerifyChangeReport({
      changedFiles: ["src/components/dashboard/dataset-edit-page-client.tsx"],
      contractIssues: [],
      testDelta: passingTestDelta,
    });

    expect(report.targetedSmoke.mode).toBe("targeted");
    expect(report.targetedSmoke.command).toBe("pnpm run test:ui:smoke:targeted");
    expect(report.targetedSmoke.journeyTitles).toContain(
      "admin can edit dataset details",
    );
    expect(report.requiredCommands).toContain("verify:test-delta");
    expect(report.requiredCommands).toContain("verify:app");
    expect(report.requiredCommands).toContain("spec:validate");
  });
});
