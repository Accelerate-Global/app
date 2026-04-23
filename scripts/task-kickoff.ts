import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  verificationCommandCatalog,
  type VerificationCommandId,
} from "../config/change-impact";
import type { GitChangedFile } from "./lib/git-status";
import {
  collectVerifyChangeReport,
  printSection,
  printVerifyChangeReport,
  type VerifyChangeCollection,
} from "./lib/verify-change-report";

const matchesGlob = (
  path as typeof path & {
    matchesGlob?: (filePath: string, pattern: string) => boolean;
  }
).matchesGlob;

export function parseTaskKickoffArgs(argv: string[]) {
  const scopes: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token !== "--scope") {
      continue;
    }

    const nextValue = argv[index + 1];

    if (!nextValue) {
      throw new Error("task:kickoff requires a value after --scope.");
    }

    scopes.push(nextValue);
    index += 1;
  }

  return {
    scopes: [...new Set(scopes.map(normalizePath))],
  };
}

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function matchesAnyScope(filePath: string, scopes: string[]) {
  return scopes.some((scope) =>
    matchesGlob ? matchesGlob(filePath, scope) : filePath === scope,
  );
}

function formatChangedFile(file: GitChangedFile) {
  return `${file.status} ${file.displayPath}`;
}

function summarizeList(items: string[]) {
  if (items.length === 0) {
    return "none";
  }

  const preview = items.slice(0, 5).join(", ");

  if (items.length <= 5) {
    return preview;
  }

  return `${preview}, +${items.length - 5} more`;
}

function matchesAnyPattern(filePath: string, patterns: string[]) {
  return patterns.some((pattern) =>
    matchesGlob ? matchesGlob(filePath, pattern) : filePath === pattern,
  );
}

function formatTargetedSmokeBrief(input: VerifyChangeCollection["report"]["targetedSmoke"]) {
  if (input.mode === "none") {
    return "none";
  }

  const details = input.summary.length > 0 ? ` (${input.summary.join(" | ")})` : "";

  return `${input.command ?? "none"}${details}`;
}

const harnessToolingPatterns = [
  "AGENTS.md",
  "config/change-impact.ts",
  "config/change-impact.manifest.json",
  "docs/testing/**",
  "scripts/**",
  "tests/ui/**",
] as const;

const testFilePatterns = [
  "tests/**",
  "**/*.test.*",
  "**/*.spec.*",
] as const;

function classifyVerificationLane(input: {
  changedFiles: GitChangedFile[];
  scopes: string[];
}) {
  const relevantFiles =
    input.scopes.length > 0
      ? input.changedFiles.filter((file) => matchesAnyScope(file.path, input.scopes))
      : input.changedFiles;

  if (relevantFiles.length === 0) {
    return "preflight (no tracked changes yet)";
  }

  const changedPaths = relevantFiles.map((file) => normalizePath(file.path));
  const hasHarnessOrToolingChanges = changedPaths.some((filePath) =>
    matchesAnyPattern(filePath, [...harnessToolingPatterns]),
  );

  if (hasHarnessOrToolingChanges) {
    return "harness / tooling";
  }

  const hasTestChanges = changedPaths.some((filePath) =>
    matchesAnyPattern(filePath, [...testFilePatterns]),
  );
  const hasNonTestChanges = changedPaths.some(
    (filePath) => !matchesAnyPattern(filePath, [...testFilePatterns]),
  );

  if (hasTestChanges) {
    return "product + test";
  }

  if (hasNonTestChanges) {
    return "product-only";
  }

  return "product-only";
}

function formatSupabaseNeed(requiredCommands: VerificationCommandId[]) {
  const commandsNeedingSupabase = requiredCommands.filter(
    (commandId) => verificationCommandCatalog[commandId].supabaseLifecycle !== "none",
  );

  if (commandsNeedingSupabase.length === 0) {
    return "not required by current required commands";
  }

  const commandList = summarizeList(
    commandsNeedingSupabase.map((commandId) => verificationCommandCatalog[commandId].command),
  );

  return `required by ${commandList}`;
}

function formatCleanTreeAction(unrelatedDirtyFiles: string[] | null) {
  if (unrelatedDirtyFiles === null) {
    return "provide --scope to classify unrelated dirty paths before broad verification";
  }

  if (unrelatedDirtyFiles.length === 0) {
    return "current scope is isolated; no unrelated dirty paths detected";
  }

  return "move to a clean worktree or isolate unrelated paths before broad verification";
}

const taskKickoffWorkflowReminder = [
  "Run pnpm run task:kickoff before editing UI, admin, DB, or verification-tooling work.",
  "Use the thin-slice loop while coding: direct tests first, smoke:check when contracts change, targeted smoke only for browser-specific debugging.",
  "Keep pnpm run verify:change:run as the single terminal gate for the current candidate tracked tree.",
  "Before rerunning a failed check, classify it as environment, test gap, contract / harness, or product and follow docs/testing/verification-triage.md.",
] as const;

export function buildTaskKickoffBrief(input: {
  changedFiles: GitChangedFile[];
  report: VerifyChangeCollection["report"];
  scopes: string[];
}) {
  const unrelatedDirtyFiles =
    input.scopes.length === 0
      ? null
      : input.changedFiles
          .filter((file) => !matchesAnyScope(file.path, input.scopes))
          .map(formatChangedFile);

  return [
    `Owned paths: ${
      input.scopes.length > 0
        ? input.scopes.join(", ")
        : "not provided; pass --scope <path-or-glob> to classify unrelated dirty files."
    }`,
    `Unrelated dirty paths: ${
      unrelatedDirtyFiles
        ? summarizeList(unrelatedDirtyFiles)
        : "not classified until --scope is provided."
    }`,
    `Clean-tree action: ${formatCleanTreeAction(unrelatedDirtyFiles)}`,
    `Verification lane: ${classifyVerificationLane({
      changedFiles: input.changedFiles,
      scopes: input.scopes,
    })}`,
    `Required commands: ${summarizeList(input.report.requiredCommands.map((commandId) => `pnpm run ${commandId}`))}`,
    `Targeted smoke subset: ${formatTargetedSmokeBrief(input.report.targetedSmoke)}`,
    `Local Supabase: ${formatSupabaseNeed(input.report.requiredCommands)}`,
    "Terminal gate: pnpm run verify:change:run",
  ];
}

export function buildTaskKickoffWorkflowReminder() {
  return [...taskKickoffWorkflowReminder];
}

export function printTaskKickoff(collection: VerifyChangeCollection, scopes: string[]) {
  printSection(
    "Task brief",
    buildTaskKickoffBrief({
      changedFiles: collection.changedFiles,
      report: collection.report,
      scopes,
    }),
  );
  printSection("Workflow reminder", buildTaskKickoffWorkflowReminder());
  printVerifyChangeReport(collection);
}

export async function runTaskKickoff(argv = process.argv.slice(2)) {
  const args = parseTaskKickoffArgs(argv);
  const collection = await collectVerifyChangeReport();

  printTaskKickoff(collection, args.scopes);
  process.exitCode = collection.report.exitCode;
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  runTaskKickoff().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
