import type { TestCase, TestResult } from "@playwright/test/reporter";
import { describe, expect, it } from "vitest";

import {
  buildSafeSmokeReport,
  toSafeSmokeTestRun,
} from "../tests/ui/support/safe-smoke-reporter";

describe("safe-smoke-reporter", () => {
  it("omits error, stdout, stderr, and attachment payloads from test runs", () => {
    const testRun = toSafeSmokeTestRun(
      {
        title: "route marker is visible",
        expectedStatus: "passed",
        outcome: () => "unexpected",
        parent: {
          project: () => ({ name: "desktop-admin" }),
        },
      } as TestCase,
      {
        status: "failed",
        duration: 123,
        retry: 1,
        errors: [{ message: "token=super-secret-value" }],
        stdout: ["super-secret-stdout"],
        stderr: ["super-secret-stderr"],
        attachments: [
          {
            name: "screenshot.png",
            contentType: "image/png",
            body: Buffer.from("super-secret-attachment"),
          },
        ],
      } as unknown as TestResult,
    );

    expect(testRun).toEqual({
      project: "desktop-admin",
      title: "route marker is visible",
      status: "failed",
      expectedStatus: "passed",
      outcome: "unexpected",
      durationMs: 123,
      retry: 1,
      errorCount: 1,
      attachmentCount: 1,
    });
    expect(JSON.stringify(testRun)).not.toContain("super-secret");
    expect(JSON.stringify(testRun)).not.toContain("screenshot.png");
  });

  it("summarizes sanitized test runs", () => {
    expect(
      buildSafeSmokeReport({
        generatedAt: "2026-04-29T00:00:00.000Z",
        status: "failed",
        durationMs: 456,
        totalExpected: 2,
        runs: [
          {
            project: "desktop-admin",
            title: "admin route marker is visible",
            status: "passed",
            expectedStatus: "passed",
            outcome: "expected",
            durationMs: 100,
            retry: 0,
            errorCount: 0,
            attachmentCount: 0,
          },
          {
            project: "desktop-pro",
            title: "pro route marker is visible",
            status: "timedOut",
            expectedStatus: "passed",
            outcome: "unexpected",
            durationMs: 200,
            retry: 0,
            errorCount: 1,
            attachmentCount: 0,
          },
        ],
      }).stats,
    ).toEqual({
      totalExpected: 2,
      completedRuns: 2,
      passed: 1,
      failed: 0,
      timedOut: 1,
      skipped: 0,
      interrupted: 0,
      unexpected: 1,
      flaky: 0,
      durationMs: 456,
    });
  });
});
