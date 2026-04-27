import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  runCommandMock,
  analyzeUiSmokeContractsMock,
  evaluateTestImpactMock,
  createVerifyChangeReportMock,
  printVerifyChangeReportMock,
  getTrackedFileTreeShaMock,
  loadVerificationReceiptMock,
  recordVerificationSuccessMock,
  recordVerificationTimingMock,
  buildLocalVerificationPlanMock,
  executeLocalVerificationPlanMock,
} = vi.hoisted(() => ({
  runCommandMock: vi.fn(),
  analyzeUiSmokeContractsMock: vi.fn(),
  evaluateTestImpactMock: vi.fn(),
  createVerifyChangeReportMock: vi.fn(),
  printVerifyChangeReportMock: vi.fn(),
  getTrackedFileTreeShaMock: vi.fn(),
  loadVerificationReceiptMock: vi.fn(),
  recordVerificationSuccessMock: vi.fn(),
  recordVerificationTimingMock: vi.fn(),
  buildLocalVerificationPlanMock: vi.fn(),
  executeLocalVerificationPlanMock: vi.fn(),
}));

vi.mock("./lib/command", () => ({
  runCommand: runCommandMock,
}));

vi.mock("./lib/ui-smoke-contract", () => ({
  analyzeUiSmokeContracts: analyzeUiSmokeContractsMock,
}));

vi.mock("./lib/test-impact", () => ({
  evaluateTestImpact: evaluateTestImpactMock,
}));

vi.mock("./lib/verify-change", () => ({
  createVerifyChangeReport: createVerifyChangeReportMock,
}));

vi.mock("./lib/verify-change-report", () => ({
  printVerifyChangeReport: printVerifyChangeReportMock,
}));

vi.mock("./lib/verification-receipts", () => ({
  getTrackedFileTreeSha: getTrackedFileTreeShaMock,
  loadVerificationReceipt: loadVerificationReceiptMock,
  recordVerificationSuccess: recordVerificationSuccessMock,
}));

vi.mock("./lib/local-verification", () => ({
  buildLocalVerificationPlan: buildLocalVerificationPlanMock,
  executeLocalVerificationPlan: executeLocalVerificationPlanMock,
}));

vi.mock("./lib/verification-timing", () => ({
  recordVerificationTiming: recordVerificationTimingMock,
}));

const passingTestDelta = {
  changedFiles: [],
  changedTestFiles: [],
  coveredSourceFiles: [],
  mappings: [],
  missingTestUpdates: [],
  exitCode: 0 as const,
};

const report = {
  changedFiles: ["scripts/ship.ts", "tests/ui/global.setup.ts"],
  domains: [],
  requiredCommands: ["typecheck"] as const,
  recommendedCommands: [],
  manualSteps: [],
  contractRequirements: [],
  contractIssues: [],
  targetedSmoke: {
    mode: "none" as const,
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
  exitCode: 0 as const,
};

describe("verify-ship-local", () => {
  beforeEach(() => {
    vi.resetModules();
    process.exitCode = undefined;
    runCommandMock.mockReset();
    analyzeUiSmokeContractsMock.mockReset();
    evaluateTestImpactMock.mockReset();
    createVerifyChangeReportMock.mockReset();
    printVerifyChangeReportMock.mockReset();
    getTrackedFileTreeShaMock.mockReset();
    loadVerificationReceiptMock.mockReset();
    recordVerificationSuccessMock.mockReset();
    recordVerificationTimingMock.mockReset();
    buildLocalVerificationPlanMock.mockReset();
    executeLocalVerificationPlanMock.mockReset();

    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (
        command === "git" &&
        args.join(" ") === "fetch --quiet --no-tags origin refs/heads/main:refs/remotes/origin/main"
      ) {
        return {
          stdout: "",
          stderr: "",
          exitCode: 0,
        };
      }

      if (
        command === "git" &&
        args.join(" ") === "diff --name-status -z origin/main...HEAD"
      ) {
        return {
          stdout: "A\0scripts/ship.ts\0D\0tests/ui/global.setup.ts\0",
          stderr: "",
          exitCode: 0,
        };
      }

      if (command === "pnpm" && args.join(" ") === "run spec:check-archive") {
        return {
          stdout: "",
          stderr: "",
          exitCode: 0,
        };
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });
    analyzeUiSmokeContractsMock.mockResolvedValue({
      issues: [],
    });
    evaluateTestImpactMock.mockResolvedValue(passingTestDelta);
    createVerifyChangeReportMock.mockReturnValue(report);
    getTrackedFileTreeShaMock.mockResolvedValue("tree-sha");
    loadVerificationReceiptMock.mockResolvedValue(null);
    buildLocalVerificationPlanMock.mockReturnValue({
      reusedCommands: [],
      steps: [],
    });
    executeLocalVerificationPlanMock.mockResolvedValue(undefined);
    recordVerificationSuccessMock.mockResolvedValue(undefined);
    recordVerificationTimingMock.mockResolvedValue(undefined);
  });

  it("collects the branch diff report without loading receipts or executing commands", async () => {
    const { collectShipLocalVerificationReport } = await import("./verify-ship-local");

    const collection = await collectShipLocalVerificationReport();

    expect(runCommandMock).toHaveBeenCalledWith(
      "git",
      [
        "fetch",
        "--quiet",
        "--no-tags",
        "origin",
        "refs/heads/main:refs/remotes/origin/main",
      ],
      expect.objectContaining({
        quiet: true,
        stdinMode: "ignore",
      }),
    );
    expect(runCommandMock).toHaveBeenCalledWith(
      "git",
      ["diff", "--name-status", "-z", "origin/main...HEAD"],
      expect.objectContaining({
        quiet: true,
        stdinMode: "ignore",
      }),
    );
    expect(collection).toEqual({
      shipLocalDiff: {
        baseRef: "origin/main",
        headRef: "HEAD",
        changedFiles: ["scripts/ship.ts", "tests/ui/global.setup.ts"],
        changedEntries: [
          {
            path: "scripts/ship.ts",
            status: "A",
            displayPath: "scripts/ship.ts",
          },
          {
            path: "tests/ui/global.setup.ts",
            status: "D",
            displayPath: "tests/ui/global.setup.ts",
          },
        ],
      },
      changedFiles: [
        {
          path: "scripts/ship.ts",
          status: "A",
          displayPath: "scripts/ship.ts",
        },
        {
          path: "tests/ui/global.setup.ts",
          status: "D",
          displayPath: "tests/ui/global.setup.ts",
        },
      ],
      report,
    });
    expect(loadVerificationReceiptMock).not.toHaveBeenCalled();
    expect(buildLocalVerificationPlanMock).not.toHaveBeenCalled();
    expect(executeLocalVerificationPlanMock).not.toHaveBeenCalled();
  });

  it("records ship-local receipts against the committed branch diff to origin/main", async () => {
    const { runVerifyShipLocal } = await import("./verify-ship-local");

    await runVerifyShipLocal();

    expect(runCommandMock).toHaveBeenCalledWith(
      "git",
      [
        "fetch",
        "--quiet",
        "--no-tags",
        "origin",
        "refs/heads/main:refs/remotes/origin/main",
      ],
      expect.objectContaining({
        quiet: true,
        stdinMode: "ignore",
      }),
    );
    expect(runCommandMock).toHaveBeenCalledWith(
      "git",
      ["diff", "--name-status", "-z", "origin/main...HEAD"],
      expect.objectContaining({
        quiet: true,
        stdinMode: "ignore",
      }),
    );
    expect(evaluateTestImpactMock).toHaveBeenCalledWith({
      rootDir: process.cwd(),
      changedFiles: ["scripts/ship.ts", "tests/ui/global.setup.ts"],
    });
    expect(loadVerificationReceiptMock).toHaveBeenCalledWith({
      rootDir: process.cwd(),
      treeSha: "tree-sha",
      changedFiles: ["scripts/ship.ts", "tests/ui/global.setup.ts"],
    });
    expect(runCommandMock).toHaveBeenCalledWith(
      "pnpm",
      ["run", "spec:check-archive"],
      expect.objectContaining({
        stdinMode: "ignore",
      }),
    );
    expect(printVerifyChangeReportMock).toHaveBeenCalledWith({
      shipLocalDiff: {
        baseRef: "origin/main",
        headRef: "HEAD",
        changedFiles: ["scripts/ship.ts", "tests/ui/global.setup.ts"],
        changedEntries: [
          {
            path: "scripts/ship.ts",
            status: "A",
            displayPath: "scripts/ship.ts",
          },
          {
            path: "tests/ui/global.setup.ts",
            status: "D",
            displayPath: "tests/ui/global.setup.ts",
          },
        ],
      },
      changedFiles: [
        {
          path: "scripts/ship.ts",
          status: "A",
          displayPath: "scripts/ship.ts",
        },
        {
          path: "tests/ui/global.setup.ts",
          status: "D",
          displayPath: "tests/ui/global.setup.ts",
        },
      ],
      report,
    });
    expect(recordVerificationSuccessMock).toHaveBeenCalledWith({
      rootDir: process.cwd(),
      treeSha: "tree-sha",
      changedFiles: ["scripts/ship.ts", "tests/ui/global.setup.ts"],
      commandIds: ["verify:ship:local"],
    });
    expect(executeLocalVerificationPlanMock).toHaveBeenCalledWith({
      rootDir: process.cwd(),
      treeSha: "tree-sha",
      changedFiles: ["scripts/ship.ts", "tests/ui/global.setup.ts"],
      plan: {
        reusedCommands: [],
        steps: [],
      },
      uiSmokeDiff: {
        baseRef: "origin/main",
        headRef: "HEAD",
      },
    });
    expect(recordVerificationTimingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rootDir: process.cwd(),
        treeSha: "tree-sha",
        changedFiles: ["scripts/ship.ts", "tests/ui/global.setup.ts"],
        scope: "verification-run",
        name: "verify:ship:local",
        status: "passed",
      }),
    );
  });

  it("records failed timing and skips receipts when the preflight report exits non-zero", async () => {
    const { runVerifyShipLocal } = await import("./verify-ship-local");

    createVerifyChangeReportMock.mockReturnValue({
      ...report,
      exitCode: 1 as const,
    });

    await runVerifyShipLocal();

    expect(process.exitCode).toBe(1);
    expect(getTrackedFileTreeShaMock).not.toHaveBeenCalled();
    expect(loadVerificationReceiptMock).not.toHaveBeenCalled();
    expect(buildLocalVerificationPlanMock).not.toHaveBeenCalled();
    expect(executeLocalVerificationPlanMock).not.toHaveBeenCalled();
    expect(recordVerificationSuccessMock).not.toHaveBeenCalled();
    expect(recordVerificationTimingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rootDir: process.cwd(),
        changedFiles: ["scripts/ship.ts", "tests/ui/global.setup.ts"],
        scope: "verification-run",
        name: "verify:ship:local",
        status: "failed",
      }),
    );
  });

  it("fails before local verification when active OpenSpec changes are not archived", async () => {
    const { runVerifyShipLocal } = await import("./verify-ship-local");

    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (
        command === "git" &&
        args.join(" ") === "fetch --quiet --no-tags origin refs/heads/main:refs/remotes/origin/main"
      ) {
        return {
          stdout: "",
          stderr: "",
          exitCode: 0,
        };
      }

      if (
        command === "git" &&
        args.join(" ") === "diff --name-status -z origin/main...HEAD"
      ) {
        return {
          stdout: "A\0openspec/changes/add-feature/proposal.md\0",
          stderr: "",
          exitCode: 0,
        };
      }

      if (command === "pnpm" && args.join(" ") === "run spec:check-archive") {
        throw new Error("Active OpenSpec changes must be archived before ship.");
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });

    await expect(runVerifyShipLocal()).rejects.toThrow(
      "Active OpenSpec changes must be archived before ship.",
    );
    expect(getTrackedFileTreeShaMock).not.toHaveBeenCalled();
    expect(recordVerificationTimingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "verification-run",
        name: "verify:ship:local",
        status: "failed",
      }),
    );
  });
});
