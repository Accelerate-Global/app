import { describe, expect, it } from "vitest";

import type { VerifyChangeReport } from "./lib/verify-change";
import {
  buildTaskKickoffBrief,
  buildTaskKickoffPilotReminder,
  parseTaskKickoffArgs,
} from "./task-kickoff";

const report: VerifyChangeReport = {
  changedFiles: ["src/components/auth/account-control.tsx"],
  domains: [],
  requiredCommands: ["typecheck", "smoke:check", "test:ui:smoke:targeted"],
  recommendedCommands: [],
  manualSteps: [],
  contractRequirements: [],
  contractIssues: [],
  targetedSmoke: {
    mode: "targeted" as const,
    matchedRuleLabels: ["Admin config flows"],
    routeIds: ["field-sources-admin"],
    journeyTitles: [],
    projectNames: ["desktop-admin"],
    testPaths: [],
    bootstrapScope: "admin-config" as const,
    command: "pnpm run test:ui:smoke:targeted",
    summary: ["Routes: field-sources-admin", "Bootstrap scope: admin-config"],
  },
  testDelta: {
    changedFiles: [],
    changedTestFiles: [],
    coveredSourceFiles: [],
    mappings: [],
    missingTestUpdates: [],
    exitCode: 0 as const,
  },
  exitCode: 0 as const,
};

describe("task-kickoff", () => {
  it("parses repeated scope flags", () => {
    expect(
      parseTaskKickoffArgs([
        "--scope",
        "src/components/auth/**",
        "--scope",
        "tests/ui/**",
      ]),
    ).toEqual({
      scopes: ["src/components/auth/**", "tests/ui/**"],
    });
  });

  it("builds a kickoff brief with unrelated dirty paths when scope is provided", () => {
    const brief = buildTaskKickoffBrief({
      changedFiles: [
        {
          path: "src/components/auth/account-control.tsx",
          status: "M",
          displayPath: "src/components/auth/account-control.tsx",
        },
        {
          path: "tests/ui/route-registry.ts",
          status: "M",
          displayPath: "tests/ui/route-registry.ts",
        },
      ],
      report,
      scopes: ["src/components/auth/**"],
    });

    expect(brief).toEqual([
      "Owned paths: src/components/auth/**",
      "Unrelated dirty paths: M tests/ui/route-registry.ts",
      "Required commands: pnpm run typecheck, pnpm run smoke:check, pnpm run test:ui:smoke:targeted",
      "Targeted smoke subset: pnpm run test:ui:smoke:targeted (Routes: field-sources-admin | Bootstrap scope: admin-config)",
      "Terminal gate: pnpm run verify:change:run",
    ]);
  });

  it("explains how to classify unrelated dirty files when scope is omitted", () => {
    const brief = buildTaskKickoffBrief({
      changedFiles: [],
      report: {
        ...report,
        requiredCommands: [],
        targetedSmoke: {
          ...report.targetedSmoke,
          mode: "none",
          command: null,
          summary: [],
        },
      },
      scopes: [],
    });

    expect(brief[0]).toContain("not provided");
    expect(brief[1]).toContain("not classified");
    expect(brief[2]).toBe("Required commands: none");
    expect(brief[3]).toBe("Targeted smoke subset: none");
  });

  it("prints the active pilot reminder for UI and admin tasks", () => {
    expect(buildTaskKickoffPilotReminder()).toEqual([
      "Active 3-task UI/admin pilot: run pnpm run task:kickoff before editing.",
      "Keep pnpm run verify:change:run as the single terminal gate for the current candidate tracked tree.",
      "Before rerunning a failed check, classify it as environment, contract / harness, or product and follow docs/testing/verification-triage.md.",
    ]);
  });
});
