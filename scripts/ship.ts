import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  waitForPullRequestChecks,
  waitForWorkflowRun,
} from "./lib/release";
import { runCommand } from "./lib/command";

const GIT_COMMAND_TIMEOUT_MS = 30_000;
const GH_COMMAND_TIMEOUT_MS = 30_000;
const DRIFT_CHECK_TIMEOUT_MS = 2 * 60_000;
const REMOTE_SEED_TIMEOUT_MS = 5 * 60_000;
const FIELD_SOURCE_SEED_INPUT_PATTERNS = [
  "scripts/seed-field-sources.ts",
  "src/lib/field-sources.ts",
  "src/data/field-sources/**",
] as const;

type PullRequestView = {
  baseRefName: string;
  headRefName: string;
  headRefOid: string;
  mergeCommit: {
    oid: string;
  } | null;
  number: number;
  state: string;
  title: string;
  url: string;
};

type PullRequestFile = {
  filename: string;
};

const matchesGlob = (
  path as typeof path & {
    matchesGlob?: (filePath: string, pattern: string) => boolean;
  }
).matchesGlob;

function logStage(message: string) {
  console.log(`[ship] ${message}`);
}

function readFlag(name: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function getPullRequest(prNumber: string) {
  const { stdout } = await runCommand(
    "gh",
    [
      "pr",
      "view",
      prNumber,
      "--json",
      "baseRefName,headRefName,headRefOid,mergeCommit,number,state,title,url",
    ],
    {
      quiet: true,
      stdinMode: "ignore",
      timeoutMs: GH_COMMAND_TIMEOUT_MS,
    },
  );

  return JSON.parse(stdout) as PullRequestView;
}

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function matchesAnyPattern(filePath: string, patterns: readonly string[]) {
  return patterns.some((pattern) =>
    matchesGlob ? matchesGlob(filePath, pattern) : filePath === pattern,
  );
}

async function listPullRequestFiles(prNumber: string) {
  const { stdout } = await runCommand(
    "gh",
    [
      "api",
      `repos/{owner}/{repo}/pulls/${prNumber}/files`,
      "--paginate",
      "--slurp",
    ],
    {
      quiet: true,
      stdinMode: "ignore",
      timeoutMs: GH_COMMAND_TIMEOUT_MS,
    },
  );

  const parsedFiles = JSON.parse(stdout) as PullRequestFile[] | PullRequestFile[][];
  const pullRequestFiles = Array.isArray(parsedFiles[0])
    ? (parsedFiles as PullRequestFile[][]).flat()
    : (parsedFiles as PullRequestFile[]);

  return pullRequestFiles.map((file) => normalizePath(file.filename));
}

function shouldSeedRemoteFieldSourceRegistry(changedFiles: string[]) {
  const normalizedChangedFiles = [...new Set(changedFiles.map(normalizePath))];

  return normalizedChangedFiles.some((filePath) =>
    matchesAnyPattern(filePath, FIELD_SOURCE_SEED_INPUT_PATTERNS),
  );
}

async function ensureCleanWorktree() {
  logStage("Checking for a clean git worktree...");
  const { stdout } = await runCommand("git", ["status", "--porcelain"], {
    quiet: true,
    stdinMode: "ignore",
    timeoutMs: GIT_COMMAND_TIMEOUT_MS,
  });

  if (stdout.trim()) {
    throw new Error("Ship requires a clean git worktree.");
  }
}

async function waitForMerge(prNumber: string) {
  const startedAt = Date.now();

  for (;;) {
    const pullRequest = await getPullRequest(prNumber);

    if (pullRequest.state === "MERGED" && pullRequest.mergeCommit?.oid) {
      return pullRequest;
    }

    if (Date.now() - startedAt > 15 * 60 * 1000) {
      throw new Error(`Timed out waiting for PR #${prNumber} to merge.`);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 3000);
    });
  }
}

export async function shipPullRequest(input: { prNumber: string }) {
  const prNumber = input.prNumber;
  if (!prNumber) {
    throw new Error("Usage: pnpm ship --pr <number>");
  }

  await ensureCleanWorktree();

  logStage(`Looking up PR #${prNumber}...`);
  let pullRequest = await getPullRequest(prNumber);

  if (pullRequest.baseRefName !== "main") {
    throw new Error(`Ship only supports PRs targeting main. Received ${pullRequest.baseRefName}.`);
  }

  const pullRequestFiles = await listPullRequestFiles(prNumber);
  const needsRemoteFieldSourceSeed = shouldSeedRemoteFieldSourceRegistry(pullRequestFiles);

  logStage("Checking linked Supabase migration drift...");
  await runCommand("pnpm", ["run", "db:check-migration-drift"], {
    stdinMode: "ignore",
    timeoutMs: DRIFT_CHECK_TIMEOUT_MS,
  });

  if (needsRemoteFieldSourceSeed) {
    logStage("Ensuring the remote field-source registry is seeded...");
    await runCommand("pnpm", ["run", "field-sources:seed:remote"], {
      stdinMode: "ignore",
      timeoutMs: REMOTE_SEED_TIMEOUT_MS,
    });
  } else {
    logStage("Skipping remote field-source seeding; PR does not touch field-source seed inputs.");
  }

  logStage(
    `Preparing to ship PR #${pullRequest.number}: ${pullRequest.title} (${pullRequest.state}, ${pullRequest.headRefName}@${pullRequest.headRefOid})`,
  );

  if (pullRequest.state !== "MERGED") {
    logStage(`Waiting for PR checks on #${pullRequest.number}...`);
    await waitForPullRequestChecks({
      prNumber,
      workflowNames: [
        "App Quality",
        "UI Smoke",
        "Database Security",
      ],
    });
    logStage(
      `Merging PR #${pullRequest.number} with head commit ${pullRequest.headRefOid}...`,
    );
    await runCommand("gh", [
      "pr",
      "merge",
      prNumber,
      "--merge",
      "--delete-branch",
      "--match-head-commit",
      pullRequest.headRefOid,
    ], {
      stdinMode: "ignore",
      timeoutMs: GH_COMMAND_TIMEOUT_MS,
    });
    logStage(`Waiting for GitHub to report the merge commit for PR #${pullRequest.number}...`);
    pullRequest = await waitForMerge(prNumber);
  } else {
    logStage(
      `PR #${pullRequest.number} is already merged at ${pullRequest.mergeCommit?.oid ?? "unknown"}. Resuming post-merge release checks.`,
    );
  }

  const mergeSha = pullRequest.mergeCommit?.oid;

  if (!mergeSha) {
    throw new Error("Merged PR is missing a merge commit SHA.");
  }

  logStage(`Syncing local main to ${mergeSha}...`);
  await runCommand("git", ["switch", "main"], {
    stdinMode: "ignore",
    timeoutMs: GIT_COMMAND_TIMEOUT_MS,
  });
  await runCommand("git", ["pull", "--ff-only"], {
    stdinMode: "ignore",
    timeoutMs: GIT_COMMAND_TIMEOUT_MS,
  });
  await runCommand("git", ["branch", "-d", pullRequest.headRefName], {
    allowFailure: true,
    stdinMode: "ignore",
    timeoutMs: GIT_COMMAND_TIMEOUT_MS,
  });
  await runCommand("git", ["remote", "prune", "origin"], {
    stdinMode: "ignore",
    timeoutMs: GIT_COMMAND_TIMEOUT_MS,
  });

  logStage(`Waiting for Release Health on ${mergeSha}...`);
  await waitForWorkflowRun({
    workflowName: "Release Health",
    commitSha: mergeSha,
  });

  logStage(`PR #${pullRequest.number} shipped successfully.`);
  logStage(`PR URL: ${pullRequest.url}`);
  logStage(`Merge SHA: ${mergeSha}`);
}

async function main() {
  const prNumber = readFlag("--pr");

  if (!prNumber) {
    throw new Error("Usage: pnpm ship --pr <number>");
  }

  await shipPullRequest({ prNumber });
}

function isMainModule(metaUrl: string) {
  return Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
