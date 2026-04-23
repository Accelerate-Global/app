import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  collectVerifyChangeReportMock,
  printVerifyChangeReportMock,
  getTrackedFileTreeShaMock,
  loadVerificationReceiptMock,
  buildLocalVerificationPlanMock,
  executeLocalVerificationPlanMock,
  recordVerificationTimingMock,
  printVerificationTimingSummaryMock,
} = vi.hoisted(() => ({
  collectVerifyChangeReportMock: vi.fn(),
  printVerifyChangeReportMock: vi.fn(),
  getTrackedFileTreeShaMock: vi.fn(),
  loadVerificationReceiptMock: vi.fn(),
  buildLocalVerificationPlanMock: vi.fn(),
  executeLocalVerificationPlanMock: vi.fn(),
  recordVerificationTimingMock: vi.fn(),
  printVerificationTimingSummaryMock: vi.fn(),
}));

vi.mock("./lib/verify-change-report", () => ({
  collectVerifyChangeReport: collectVerifyChangeReportMock,
  printVerifyChangeReport: printVerifyChangeReportMock,
}));

vi.mock("./lib/verification-receipts", () => ({
  getTrackedFileTreeSha: getTrackedFileTreeShaMock,
  loadVerificationReceipt: loadVerificationReceiptMock,
}));

vi.mock("./lib/local-verification", () => ({
  buildLocalVerificationPlan: buildLocalVerificationPlanMock,
  executeLocalVerificationPlan: executeLocalVerificationPlanMock,
}));

vi.mock("./lib/verification-timing", () => ({
  recordVerificationTiming: recordVerificationTimingMock,
}));

vi.mock("./lib/verification-timing-summary", () => ({
  printVerificationTimingSummary: printVerificationTimingSummaryMock,
}));

const passingTestDelta = {
  changedFiles: [],
  changedTestFiles: [],
  coveredSourceFiles: [],
  mappings: [],
  missingTestUpdates: [],
  exitCode: 0 as const,
};

describe("verify-change-run", () => {
  beforeEach(() => {
    vi.resetModules();
    process.exitCode = undefined;
    collectVerifyChangeReportMock.mockReset();
    printVerifyChangeReportMock.mockReset();
    getTrackedFileTreeShaMock.mockReset();
    loadVerificationReceiptMock.mockReset();
    buildLocalVerificationPlanMock.mockReset();
    executeLocalVerificationPlanMock.mockReset();
    recordVerificationTimingMock.mockReset();
    printVerificationTimingSummaryMock.mockReset();

    collectVerifyChangeReportMock.mockResolvedValue({
      changedFiles: [
        {
          path: "src/components/auth/account-control.tsx",
          status: "M",
          displayPath: "src/components/auth/account-control.tsx",
        },
      ],
      report: {
        changedFiles: ["src/components/auth/account-control.tsx"],
        domains: [],
        requiredCommands: ["typecheck"],
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
      },
    });
    getTrackedFileTreeShaMock.mockResolvedValue("tree-sha");
    loadVerificationReceiptMock.mockResolvedValue(null);
    buildLocalVerificationPlanMock.mockReturnValue({
      reusedCommands: [],
      steps: [],
    });
    executeLocalVerificationPlanMock.mockResolvedValue(undefined);
    recordVerificationTimingMock.mockResolvedValue(undefined);
    printVerificationTimingSummaryMock.mockResolvedValue(undefined);
  });

  it("records and prints a timing summary after a successful change run", async () => {
    const { runVerifyChangeRun } = await import("./verify-change-run");

    await runVerifyChangeRun();

    expect(printVerifyChangeReportMock).toHaveBeenCalled();
    expect(recordVerificationTimingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFiles: ["src/components/auth/account-control.tsx"],
        name: "verify:change:run",
        rootDir: process.cwd(),
        scope: "verification-run",
        status: "passed",
        treeSha: "tree-sha",
      }),
    );
    expect(printVerificationTimingSummaryMock).toHaveBeenCalledWith({
      rootDir: process.cwd(),
      changedFiles: ["src/components/auth/account-control.tsx"],
    });
  });

  it("records a failed change-run timing when the preflight report is blocking", async () => {
    collectVerifyChangeReportMock.mockResolvedValueOnce({
      changedFiles: [],
      report: {
        changedFiles: ["src/components/auth/account-control.tsx"],
        domains: [],
        requiredCommands: [],
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
        exitCode: 1 as const,
      },
    });
    const { runVerifyChangeRun } = await import("./verify-change-run");

    await runVerifyChangeRun();

    expect(process.exitCode).toBe(1);
    expect(recordVerificationTimingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFiles: ["src/components/auth/account-control.tsx"],
        name: "verify:change:run",
        scope: "verification-run",
        status: "failed",
      }),
    );
    expect(executeLocalVerificationPlanMock).not.toHaveBeenCalled();
    expect(printVerificationTimingSummaryMock).toHaveBeenCalledWith({
      rootDir: process.cwd(),
      changedFiles: ["src/components/auth/account-control.tsx"],
    });
  });
});
