import { describe, expect, it } from "vitest";

import type { VerifyChangeReport } from "./lib/verify-change";
import {
  buildTaskKickoffBrief,
  buildTaskKickoffWorkflowReminder,
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
      "Clean-tree action: move to a clean worktree or isolate unrelated paths before broad verification",
      "Verification lane: product-only",
      "Required commands: pnpm run typecheck, pnpm run smoke:check, pnpm run test:ui:smoke:targeted",
      "Targeted smoke subset: pnpm run test:ui:smoke:targeted (Routes: field-sources-admin | Bootstrap scope: admin-config)",
      "Local Supabase: required by pnpm run test:ui:smoke:targeted",
      "Terminal gate: pnpm run verify:change:run",
    ]);
  });

  it("classifies verification-tooling diffs as a harness lane", () => {
    const brief = buildTaskKickoffBrief({
      changedFiles: [
        {
          path: "scripts/run-ui-smoke.ts",
          status: "M",
          displayPath: "scripts/run-ui-smoke.ts",
        },
      ],
      report: {
        ...report,
        requiredCommands: ["smoke:check", "test:ui:smoke"],
        targetedSmoke: {
          ...report.targetedSmoke,
          mode: "full",
          command: "pnpm run test:ui:smoke",
          summary: ["Full suite required because the smoke harness or browser runner changed."],
        },
      },
      scopes: ["scripts/**"],
    });

    expect(brief).toEqual([
      "Owned paths: scripts/**",
      "Unrelated dirty paths: none",
      "Clean-tree action: current scope is isolated; no unrelated dirty paths detected",
      "Verification lane: harness / tooling",
      "Required commands: pnpm run smoke:check, pnpm run test:ui:smoke",
      "Targeted smoke subset: pnpm run test:ui:smoke (Full suite required because the smoke harness or browser runner changed.)",
      "Local Supabase: required by pnpm run test:ui:smoke",
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
    expect(brief[2]).toContain("provide --scope");
    expect(brief[3]).toBe("Verification lane: preflight (no tracked changes yet)");
    expect(brief[4]).toBe("Required commands: none");
    expect(brief[5]).toBe("Targeted smoke subset: none");
    expect(brief[6]).toBe("Local Supabase: not required by current required commands");
  });

  it("prints the default workflow reminder for verification-first delivery", () => {
    expect(buildTaskKickoffWorkflowReminder()).toEqual([
      "Run pnpm run task:kickoff before editing UI, admin, DB, or verification-tooling work.",
      "Use the thin-slice loop while coding: direct tests first, smoke:check when contracts change, targeted smoke only for browser-specific debugging.",
      "Keep pnpm run verify:change:run as the single terminal gate for the current candidate tracked tree.",
      "Before rerunning a failed check, classify it as environment, test gap, contract / harness, or product and follow docs/testing/verification-triage.md.",
    ]);
  });
});
