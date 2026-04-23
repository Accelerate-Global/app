import path from "node:path";

import { printSection } from "./verify-change-report";
import { readVerificationTimings, type VerificationTimingSample } from "./verification-timing";

const verificationTimingOrder = [
  "typecheck",
  "verify:test-delta",
  "verify:app",
  "smoke:check",
  "test:ui:smoke:targeted",
  "test:ui:smoke",
  "verify:change:run",
  "verify:ship:local",
] as const;

type VerificationTimingRollup = {
  failedRuns: number;
  latestDurationMs: number;
  latestStatus: VerificationTimingSample["status"];
  latestTimestamp: string;
  name: string;
  passedRuns: number;
  totalRuns: number;
};

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function normalizeChangedFiles(changedFiles: string[] | undefined) {
  if (!changedFiles) {
    return undefined;
  }

  return [...new Set(changedFiles.map(normalizePath))].sort();
}

function matchesChangedFiles(
  sample: VerificationTimingSample,
  changedFiles: string[] | undefined,
) {
  if (!changedFiles) {
    return true;
  }

  if (!sample.changedFiles) {
    return false;
  }

  return (
    sample.changedFiles.length === changedFiles.length &&
    sample.changedFiles.every((filePath, index) => filePath === changedFiles[index])
  );
}

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1_000).toFixed(1)}s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);

  return `${minutes}m ${seconds}s`;
}

function buildTimingLine(rollup: VerificationTimingRollup) {
  const runsLabel = rollup.totalRuns === 1 ? "run" : "runs";

  return `${rollup.name}: ${rollup.totalRuns} ${runsLabel} (${rollup.passedRuns} passed, ${rollup.failedRuns} failed), latest ${formatDuration(rollup.latestDurationMs)} [${rollup.latestStatus}]`;
}

export function summarizeVerificationTimings(input: {
  changedFiles?: string[];
  samples: VerificationTimingSample[];
}) {
  const normalizedChangedFiles = normalizeChangedFiles(input.changedFiles);
  const matchingSamples = input.samples.filter((sample) =>
    matchesChangedFiles(sample, normalizedChangedFiles),
  );
  const rollupByName = new Map<string, VerificationTimingRollup>();

  for (const sample of matchingSamples) {
    const existing = rollupByName.get(sample.name);

    if (!existing) {
      rollupByName.set(sample.name, {
        failedRuns: sample.status === "failed" ? 1 : 0,
        latestDurationMs: sample.durationMs,
        latestStatus: sample.status,
        latestTimestamp: sample.recordedAt,
        name: sample.name,
        passedRuns: sample.status === "passed" ? 1 : 0,
        totalRuns: 1,
      });
      continue;
    }

    existing.totalRuns += 1;
    existing.passedRuns += sample.status === "passed" ? 1 : 0;
    existing.failedRuns += sample.status === "failed" ? 1 : 0;

    if (sample.recordedAt >= existing.latestTimestamp) {
      existing.latestDurationMs = sample.durationMs;
      existing.latestStatus = sample.status;
      existing.latestTimestamp = sample.recordedAt;
    }
  }

  const knownNames = new Set<string>(verificationTimingOrder);
  const orderedRollups = [
    ...verificationTimingOrder
      .map((name) => rollupByName.get(name))
      .filter((rollup): rollup is VerificationTimingRollup => Boolean(rollup)),
    ...[...rollupByName.values()]
      .filter((rollup) => !knownNames.has(rollup.name))
      .sort((left, right) => left.name.localeCompare(right.name)),
  ];

  return {
    changedFiles: normalizedChangedFiles,
    matchingSamples,
    rollups: orderedRollups,
  };
}

export async function printVerificationTimingSummary(input: {
  changedFiles?: string[];
  rootDir: string;
}) {
  const summary = summarizeVerificationTimings({
    changedFiles: input.changedFiles,
    samples: await readVerificationTimings(input.rootDir),
  });

  printSection(
    "Verification timing summary",
    summary.rollups.length > 0
      ? summary.rollups.map(buildTimingLine)
      : ["No timing samples recorded yet for the current changed-file set."],
  );
}
