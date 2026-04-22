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
    runCommandMock.mockReset();
    analyzeUiSmokeContractsMock.mockReset();
    evaluateTestImpactMock.mockReset();
    createVerifyChangeReportMock.mockReset();
    printVerifyChangeReportMock.mockReset();
    getTrackedFileTreeShaMock.mockReset();
    loadVerificationReceiptMock.mockReset();
    recordVerificationSuccessMock.mockReset();
    buildLocalVerificationPlanMock.mockReset();
    executeLocalVerificationPlanMock.mockReset();

    runCommandMock.mockResolvedValue({
      stdout: "scripts/ship.ts\0tests/ui/global.setup.ts\0",
      stderr: "",
      exitCode: 0,
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
  });

  it("records ship-local receipts against the committed branch diff to origin/main", async () => {
    const { runVerifyShipLocal } = await import("./verify-ship-local");

    await runVerifyShipLocal();

    expect(runCommandMock).toHaveBeenCalledWith(
      "git",
      ["diff", "--name-only", "-z", "origin/main...HEAD"],
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
    expect(printVerifyChangeReportMock).toHaveBeenCalledWith({
      changedFiles: [
        {
          path: "scripts/ship.ts",
          status: "M",
          displayPath: "scripts/ship.ts",
        },
        {
          path: "tests/ui/global.setup.ts",
          status: "M",
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
  });
});
