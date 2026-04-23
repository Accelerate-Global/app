import { describe, expect, it } from "vitest";

import { buildVerifyChangeSections } from "./verify-change-report";

describe("verify-change-report", () => {
  it("labels commands by workflow stage and includes the terminal-gate warning", () => {
    const sections = buildVerifyChangeSections({
      changedFiles: [
        {
          path: "src/components/auth/account-control.tsx",
          status: "M",
          displayPath: "src/components/auth/account-control.tsx",
        },
      ],
      report: {
        changedFiles: ["src/components/auth/account-control.tsx"],
        domains: [
          {
            id: "app",
            label: "Application and script runtime",
            patterns: [],
            requiredCommands: [],
            recommendedCommands: [],
            manualSteps: [],
            contractRequirements: [],
          },
        ],
        requiredCommands: ["typecheck", "smoke:check", "test:ui:smoke"],
        recommendedCommands: ["test:ui:smoke:targeted"],
        manualSteps: [],
        contractRequirements: [],
        contractIssues: [],
        targetedSmoke: {
          mode: "full",
          matchedRuleLabels: ["Smoke harness and browser runner changes"],
          routeIds: [],
          journeyTitles: [],
          projectNames: ["desktop-admin"],
          testPaths: [],
          bootstrapScope: "full",
          command: "pnpm run test:ui:smoke",
          summary: ["Full suite required because the smoke harness or browser runner changed."],
        },
        testDelta: {
          changedFiles: [],
          changedTestFiles: [],
          coveredSourceFiles: [],
          mappings: [],
          missingTestUpdates: [],
          exitCode: 0,
        },
        exitCode: 0,
      },
    });

    expect(sections.find((section) => section.title === "Planning commands")?.items).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "[planning] pnpm run task:kickoff -- --scope <path-or-glob>: Record the kickoff brief for the current task, including unrelated dirty files, verification lane, local Supabase need, and the terminal gate.",
        ),
      ]),
    );
    expect(sections.find((section) => section.title === "Required commands")?.items).toEqual(
      expect.arrayContaining([
        "[terminal] pnpm run typecheck: TypeScript static analysis for repo code and scripts.",
        "[debug] pnpm run smoke:check: Regenerate the shared UI smoke fixture manifest and validate smoke contracts.",
        "[terminal] pnpm run test:ui:smoke: Run the full Playwright UI smoke suite against the local stack.",
      ]),
    );
    expect(sections.find((section) => section.title === "Workflow warnings")?.items).toEqual(
      [
        "Do not run pnpm run test:ui:smoke manually before pnpm run verify:change:run unless you are isolating a browser-specific failure after targeted smoke or the terminal gate fails.",
        "Before rerunning a failed check, classify it as environment, test gap, contract / harness, or product and follow docs/testing/verification-triage.md.",
      ],
    );
  });
});
