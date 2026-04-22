import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type VerificationTimingSample = {
  changedFiles?: string[];
  durationMs: number;
  name: string;
  recordedAt: string;
  scope: "command" | "ship-run" | "verification-run";
  status: "failed" | "passed";
  treeSha?: string;
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

function getTimingLogPath(rootDir: string) {
  return path.join(rootDir, ".tmp", "verify-cache", "timings.jsonl");
}

export async function recordVerificationTiming(input: {
  changedFiles?: string[];
  durationMs: number;
  name: string;
  rootDir: string;
  scope: VerificationTimingSample["scope"];
  status: VerificationTimingSample["status"];
  treeSha?: string;
}) {
  const sample: VerificationTimingSample = {
    changedFiles: normalizeChangedFiles(input.changedFiles),
    durationMs: input.durationMs,
    name: input.name,
    recordedAt: new Date().toISOString(),
    scope: input.scope,
    status: input.status,
    treeSha: input.treeSha,
  };

  await mkdir(path.dirname(getTimingLogPath(input.rootDir)), { recursive: true });
  await appendFile(
    getTimingLogPath(input.rootDir),
    `${JSON.stringify(sample)}\n`,
    "utf8",
  );
}

export async function readVerificationTimings(rootDir: string) {
  try {
    const content = await readFile(getTimingLogPath(rootDir), "utf8");

    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as VerificationTimingSample);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}
