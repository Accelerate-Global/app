import { describe, expect, it } from "vitest";

import { summarizeVerificationTimings } from "./verification-timing-summary";

describe("verification-timing-summary", () => {
  it("groups repeated runs for the same changed-file set so full-smoke reruns are obvious", () => {
    const summary = summarizeVerificationTimings({
      changedFiles: ["src/components/auth/account-control.tsx"],
      samples: [
        {
          changedFiles: ["src/components/auth/account-control.tsx"],
          durationMs: 500,
          name: "spec:validate",
          recordedAt: "2026-04-22T00:59:00.000Z",
          scope: "command",
          status: "passed",
        },
        {
          changedFiles: ["src/components/auth/account-control.tsx"],
          durationMs: 10_000,
          name: "test:ui:smoke",
          recordedAt: "2026-04-22T01:00:00.000Z",
          scope: "command",
          status: "failed",
        },
        {
          changedFiles: ["src/components/auth/account-control.tsx"],
          durationMs: 65_000,
          name: "test:ui:smoke",
          recordedAt: "2026-04-22T01:05:00.000Z",
          scope: "command",
          status: "passed",
        },
        {
          changedFiles: ["src/components/auth/account-control.tsx"],
          durationMs: 90_000,
          name: "verify:change:run",
          recordedAt: "2026-04-22T01:06:00.000Z",
          scope: "verification-run",
          status: "passed",
        },
        {
          changedFiles: ["src/other.ts"],
          durationMs: 123,
          name: "typecheck",
          recordedAt: "2026-04-22T01:06:30.000Z",
          scope: "command",
          status: "passed",
        },
      ],
    });

    expect(summary.rollups).toEqual([
      {
        failedRuns: 0,
        latestDurationMs: 500,
        latestStatus: "passed",
        latestTimestamp: "2026-04-22T00:59:00.000Z",
        name: "spec:validate",
        passedRuns: 1,
        totalRuns: 1,
      },
      {
        failedRuns: 1,
        latestDurationMs: 65_000,
        latestStatus: "passed",
        latestTimestamp: "2026-04-22T01:05:00.000Z",
        name: "test:ui:smoke",
        passedRuns: 1,
        totalRuns: 2,
      },
      {
        failedRuns: 0,
        latestDurationMs: 90_000,
        latestStatus: "passed",
        latestTimestamp: "2026-04-22T01:06:00.000Z",
        name: "verify:change:run",
        passedRuns: 1,
        totalRuns: 1,
      },
    ]);
  });
});
