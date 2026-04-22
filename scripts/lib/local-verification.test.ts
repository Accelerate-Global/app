import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VerifyChangeReport } from "./verify-change";
import {
  buildLocalVerificationPlan,
  executeLocalVerificationPlan,
} from "./local-verification";
import type { VerificationReceipt } from "./verification-receipts";

const { runCommandMock, recordVerificationSuccessMock } = vi.hoisted(() => ({
  runCommandMock: vi.fn(),
  recordVerificationSuccessMock: vi.fn(),
}));

vi.mock("./command", () => ({
  runCommand: runCommandMock,
}));

vi.mock("./verification-receipts", async () => {
  const actual = await vi.importActual<typeof import("./verification-receipts")>(
    "./verification-receipts",
  );

  return {
    ...actual,
    recordVerificationSuccess: recordVerificationSuccessMock,
  };
});

const passingTestDelta = {
  changedFiles: [],
  changedTestFiles: [],
  coveredSourceFiles: [],
  mappings: [],
  missingTestUpdates: [],
  exitCode: 0 as const,
};

function createReport(
  overrides: Partial<VerifyChangeReport> = {},
): VerifyChangeReport {
  return {
    changedFiles: [],
    domains: [],
    requiredCommands: [],
    recommendedCommands: [],
    manualSteps: [],
    contractRequirements: [],
    contractIssues: [],
    targetedSmoke: {
      mode: "none",
      matchedRuleLabels: [],
      routeIds: [],
      journeyTitles: [],
      projectNames: [],
      testPaths: [],
      bootstrapScope: null,
      command: null,
      summary: [],
    },
    testDelta: passingTestDelta,
    exitCode: 0,
    ...overrides,
  };
}

function createReceipt(
  commands: VerificationReceipt["commands"],
): VerificationReceipt {
  return {
    treeSha: "tree-sha",
    changedFiles: ["src/components/dashboard/dataset-table.tsx"],
    commands,
  };
}

describe("local-verification", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
    recordVerificationSuccessMock.mockReset();
    runCommandMock.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
    recordVerificationSuccessMock.mockResolvedValue(undefined);
  });

  it("skips an explicit smoke:check run when targeted smoke will run in the same pass", () => {
    const plan = buildLocalVerificationPlan({
      mode: "change-run",
      receipt: null,
      report: createReport({
        requiredCommands: ["smoke:check", "test:ui:smoke:targeted"],
        targetedSmoke: {
          mode: "targeted",
          matchedRuleLabels: ["Dashboard datasets and dataset detail flows"],
          routeIds: ["dataset-detail-admin"],
          journeyTitles: ["admin can edit dataset details"],
          projectNames: ["desktop-admin"],
          testPaths: [],
          bootstrapScope: "datasets",
          command: "pnpm run test:ui:smoke:targeted",
          summary: [],
        },
      }),
    });

    expect(plan.steps).toEqual([
      {
        kind: "command",
        commandId: "test:ui:smoke:targeted",
      },
    ]);
  });

  it("runs only the missing full smoke step at ship time when targeted smoke already passed", () => {
    const plan = buildLocalVerificationPlan({
      mode: "ship-local",
      receipt: createReceipt({
        "typecheck": {
          passedAt: "2026-04-17T00:00:00.000Z",
        },
        "verify:app": {
          passedAt: "2026-04-17T00:00:00.000Z",
        },
        "test:ui:smoke:targeted": {
          passedAt: "2026-04-17T00:00:00.000Z",
        },
      }),
      report: createReport({
        requiredCommands: ["typecheck", "verify:app"],
        targetedSmoke: {
          mode: "targeted",
          matchedRuleLabels: ["Dashboard datasets and dataset detail flows"],
          routeIds: ["dataset-detail-admin"],
          journeyTitles: ["admin can edit dataset details"],
          projectNames: ["desktop-admin"],
          testPaths: [],
          bootstrapScope: "datasets",
          command: "pnpm run test:ui:smoke:targeted",
          summary: [],
        },
      }),
    });

    expect(plan.reusedCommands).toEqual(
      expect.arrayContaining(["typecheck", "verify:app", "test:ui:smoke:targeted"]),
    );
    expect(plan.steps).toEqual([
      {
        kind: "command",
        commandId: "test:ui:smoke",
      },
    ]);
  });

  it("uses the combined smoke step when ship-local still needs targeted and full smoke", () => {
    const plan = buildLocalVerificationPlan({
      mode: "ship-local",
      receipt: null,
      report: createReport({
        requiredCommands: ["typecheck", "verify:app"],
        targetedSmoke: {
          mode: "targeted",
          matchedRuleLabels: ["Dashboard datasets and dataset detail flows"],
          routeIds: ["dataset-detail-admin"],
          journeyTitles: ["admin can edit dataset details"],
          projectNames: ["desktop-admin"],
          testPaths: [],
          bootstrapScope: "datasets",
          command: "pnpm run test:ui:smoke:targeted",
          summary: [],
        },
      }),
    });

    expect(plan.steps).toEqual([
      {
        kind: "command",
        commandId: "typecheck",
      },
      {
        kind: "command",
        commandId: "verify:app",
      },
      {
        kind: "combined-ui-smoke",
      },
    ]);
  });

  it("prefers the full suite over the combined step when the selection already resolves to full", () => {
    const plan = buildLocalVerificationPlan({
      mode: "change-run",
      receipt: null,
      report: createReport({
        requiredCommands: ["smoke:check", "test:ui:smoke", "test:ui:smoke:targeted"],
        targetedSmoke: {
          mode: "full",
          matchedRuleLabels: ["Smoke harness and browser runner changes"],
          routeIds: [],
          journeyTitles: [],
          projectNames: [
            "desktop-anonymous",
            "desktop-viewer",
            "desktop-admin",
            "mobile-anonymous",
            "mobile-viewer",
            "mobile-admin",
          ],
          testPaths: [],
          bootstrapScope: "full",
          command: "pnpm run test:ui:smoke",
          summary: ["Full suite required because the smoke harness or browser runner changed."],
        },
      }),
    });

    expect(plan.steps).toEqual([
      {
        kind: "command",
        commandId: "test:ui:smoke",
      },
    ]);
  });

  it("treats full-suite smoke receipts as satisfying targeted smoke receipts too", () => {
    const plan = buildLocalVerificationPlan({
      mode: "change-run",
      receipt: createReceipt({
        "test:ui:smoke": {
          passedAt: "2026-04-17T00:00:00.000Z",
        },
      }),
      report: createReport({
        requiredCommands: ["smoke:check", "test:ui:smoke:targeted", "test:ui:smoke"],
        targetedSmoke: {
          mode: "full",
          matchedRuleLabels: ["Smoke harness and browser runner changes"],
          routeIds: [],
          journeyTitles: [],
          projectNames: [
            "desktop-anonymous",
            "desktop-viewer",
            "desktop-admin",
            "mobile-anonymous",
            "mobile-viewer",
            "mobile-admin",
          ],
          testPaths: [],
          bootstrapScope: "full",
          command: "pnpm run test:ui:smoke",
          summary: ["Full suite required because the smoke harness or browser runner changed."],
        },
      }),
    });

    expect(plan.reusedCommands).toEqual(
      expect.arrayContaining(["test:ui:smoke"]),
    );
    expect(plan.steps).toEqual([]);
  });

  it("does not pre-start Supabase for self-managed db:security and prunes once at the end", async () => {
    await executeLocalVerificationPlan({
      rootDir: "/repo",
      treeSha: "tree-sha",
      changedFiles: ["supabase/tests/database-security.test.sql"],
      plan: {
        reusedCommands: [],
        steps: [
          {
            kind: "command",
            commandId: "db:security",
          },
        ],
      },
    });

    expect(runCommandMock.mock.calls).toEqual([
      ["supabase", ["stop"]],
      ["pnpm", ["run", "db:security"]],
      ["supabase", ["stop"]],
      ["docker", ["container", "prune", "-f"]],
    ]);
    expect(runCommandMock).not.toHaveBeenCalledWith(
      "supabase",
      expect.arrayContaining(["start"]),
    );
    expect(recordVerificationSuccessMock).toHaveBeenCalledWith({
      rootDir: "/repo",
      treeSha: "tree-sha",
      changedFiles: ["supabase/tests/database-security.test.sql"],
      commandIds: ["db:security"],
    });
  });

  it("prunes after a Supabase-backed failure and does not record a receipt for the failed step", async () => {
    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === "pnpm" && args.join(" ") === "run test:ui:smoke") {
        throw new Error("smoke failed");
      }

      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
      };
    });

    await expect(
      executeLocalVerificationPlan({
        rootDir: "/repo",
        treeSha: "tree-sha",
        changedFiles: ["src/components/dashboard/dataset-table.tsx"],
        plan: {
          reusedCommands: [],
          steps: [
            {
              kind: "command",
              commandId: "test:ui:smoke",
            },
          ],
        },
      }),
    ).rejects.toThrow("smoke failed");

    expect(runCommandMock.mock.calls).toEqual([
      ["supabase", ["stop"]],
      ["pnpm", ["run", "test:ui:smoke"]],
      ["supabase", ["stop"]],
      ["docker", ["container", "prune", "-f"]],
    ]);
    expect(recordVerificationSuccessMock).not.toHaveBeenCalled();
  });
});
