import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

const DEFAULT_OUTPUT_FILE = "output/playwright/safe-smoke-results/results.json";

export type SafeSmokeTestRun = {
  project: string;
  title: string;
  status: TestResult["status"];
  expectedStatus: TestCase["expectedStatus"];
  outcome: ReturnType<TestCase["outcome"]>;
  durationMs: number;
  retry: number;
  errorCount: number;
  attachmentCount: number;
};

export type SafeSmokeReport = {
  schemaVersion: 1;
  generatedAt: string;
  status: FullResult["status"];
  stats: {
    totalExpected: number;
    completedRuns: number;
    passed: number;
    failed: number;
    timedOut: number;
    skipped: number;
    interrupted: number;
    unexpected: number;
    flaky: number;
    durationMs: number;
  };
  tests: SafeSmokeTestRun[];
};

export function toSafeSmokeTestRun(
  test: TestCase,
  result: TestResult,
): SafeSmokeTestRun {
  return {
    project: test.parent.project()?.name ?? "unknown",
    title: test.title,
    status: result.status,
    expectedStatus: test.expectedStatus,
    outcome: test.outcome(),
    durationMs: result.duration,
    retry: result.retry,
    errorCount: result.errors.length,
    attachmentCount: result.attachments.length,
  };
}

export function buildSafeSmokeReport(input: {
  generatedAt: string;
  status: FullResult["status"];
  durationMs: number;
  totalExpected: number;
  runs: SafeSmokeTestRun[];
}): SafeSmokeReport {
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    status: input.status,
    stats: {
      totalExpected: input.totalExpected,
      completedRuns: input.runs.length,
      passed: input.runs.filter((run) => run.status === "passed").length,
      failed: input.runs.filter((run) => run.status === "failed").length,
      timedOut: input.runs.filter((run) => run.status === "timedOut").length,
      skipped: input.runs.filter((run) => run.status === "skipped").length,
      interrupted: input.runs.filter((run) => run.status === "interrupted").length,
      unexpected: input.runs.filter((run) => run.outcome === "unexpected").length,
      flaky: input.runs.filter((run) => run.outcome === "flaky").length,
      durationMs: input.durationMs,
    },
    tests: input.runs,
  };
}

async function writeSafeSmokeReport(
  outputFile: string,
  report: SafeSmokeReport,
) {
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`);
}

export default class SafeSmokeReporter implements Reporter {
  private readonly outputFile: string;
  private totalExpected = 0;
  private readonly runs: SafeSmokeTestRun[] = [];

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile ?? DEFAULT_OUTPUT_FILE;
  }

  printsToStdio() {
    return false;
  }

  onBegin(_config: unknown, suite: Suite) {
    this.totalExpected = suite.allTests().length;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.runs.push(toSafeSmokeTestRun(test, result));
  }

  async onEnd(result: FullResult) {
    await writeSafeSmokeReport(
      this.outputFile,
      buildSafeSmokeReport({
        generatedAt: new Date().toISOString(),
        status: result.status,
        durationMs: result.duration,
        totalExpected: this.totalExpected,
        runs: this.runs,
      }),
    );
  }
}
