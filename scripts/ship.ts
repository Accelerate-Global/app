import { pathToFileURL } from "node:url";

import {
  smokeCheckDeployment,
  waitForGitHubDeployment,
  waitForPullRequestChecks,
  waitForWorkflowRun,
} from "./lib/release";
import { runCommand } from "./lib/command";

const GIT_COMMAND_TIMEOUT_MS = 30_000;
const GH_COMMAND_TIMEOUT_MS = 30_000;
const DRIFT_CHECK_TIMEOUT_MS = 2 * 60_000;
const REMOTE_SEED_TIMEOUT_MS = 5 * 60_000;

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

  logStage("Checking linked Supabase migration drift...");
  await runCommand("pnpm", ["run", "db:check-migration-drift"], {
    stdinMode: "ignore",
    timeoutMs: DRIFT_CHECK_TIMEOUT_MS,
  });

  logStage("Ensuring the remote field-source registry is seeded...");
  await runCommand("pnpm", ["run", "field-sources:seed:remote"], {
    stdinMode: "ignore",
    timeoutMs: REMOTE_SEED_TIMEOUT_MS,
  });

  logStage(`Looking up PR #${prNumber}...`);
  let pullRequest = await getPullRequest(prNumber);

  if (pullRequest.baseRefName !== "main") {
    throw new Error(`Ship only supports PRs targeting main. Received ${pullRequest.baseRefName}.`);
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

  logStage(`Waiting for the git-based production deployment for ${mergeSha}...`);
  const deployment = await waitForGitHubDeployment({
    commitSha: mergeSha,
  });
  logStage(`Verifying the production alias for ${mergeSha}...`);
  const smokeCheck = await smokeCheckDeployment({
    productionUrl: "https://data.accelerateglobal.org",
    expectedTitle: "Accelerate Global",
  });

  logStage(`PR #${pullRequest.number} shipped successfully.`);
  logStage(`PR URL: ${pullRequest.url}`);
  logStage(`Merge SHA: ${mergeSha}`);
  logStage(`Production deployment: ${deployment.deploymentUrl}`);
  logStage(`Production alias: ${smokeCheck.productionUrl}`);
  logStage(`Vercel deployment id: ${smokeCheck.deploymentId}`);
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
