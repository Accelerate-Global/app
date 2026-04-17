import { pathToFileURL } from "node:url";

import {
  smokeCheckDeployment,
  waitForGitHubDeployment,
  waitForPullRequestChecks,
  waitForWorkflowRun,
} from "./lib/release";
import { runCommand } from "./lib/command";

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
    { quiet: true },
  );

  return JSON.parse(stdout) as PullRequestView;
}

async function ensureCleanWorktree() {
  const { stdout } = await runCommand("git", ["status", "--porcelain"], {
    quiet: true,
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

  console.log("Checking linked Supabase migration drift...");
  await runCommand("pnpm", ["run", "db:check-migration-drift"]);

  console.log("Ensuring the remote field-source registry is seeded...");
  await runCommand("pnpm", ["run", "field-sources:seed:remote"]);

  let pullRequest = await getPullRequest(prNumber);

  if (pullRequest.baseRefName !== "main") {
    throw new Error(`Ship only supports PRs targeting main. Received ${pullRequest.baseRefName}.`);
  }

  console.log(`Preparing to ship PR #${pullRequest.number}: ${pullRequest.title}`);

  if (pullRequest.state !== "MERGED") {
    console.log(`Waiting for PR checks on #${pullRequest.number}...`);
    await waitForPullRequestChecks({
      prNumber,
      workflowNames: [
        "App Quality",
        "UI Smoke",
        "Database Security",
      ],
    });
    await runCommand("gh", [
      "pr",
      "merge",
      prNumber,
      "--merge",
      "--delete-branch",
      "--match-head-commit",
      pullRequest.headRefOid,
    ]);
    pullRequest = await waitForMerge(prNumber);
  }

  const mergeSha = pullRequest.mergeCommit?.oid;

  if (!mergeSha) {
    throw new Error("Merged PR is missing a merge commit SHA.");
  }

  console.log(`Syncing local main to ${mergeSha}...`);
  await runCommand("git", ["switch", "main"]);
  await runCommand("git", ["pull", "--ff-only"]);
  await runCommand("git", ["branch", "-d", pullRequest.headRefName], {
    allowFailure: true,
  });
  await runCommand("git", ["remote", "prune", "origin"]);

  console.log(`Waiting for Release Health on ${mergeSha}...`);
  await waitForWorkflowRun({
    workflowName: "Release Health",
    commitSha: mergeSha,
  });

  console.log(`Waiting for the git-based production deployment for ${mergeSha}...`);
  const deployment = await waitForGitHubDeployment({
    commitSha: mergeSha,
  });
  const smokeCheck = await smokeCheckDeployment({
    productionUrl: "https://data.accelerateglobal.org",
    expectedTitle: "Accelerate Global",
  });

  console.log(`PR #${pullRequest.number} shipped successfully.`);
  console.log(`PR URL: ${pullRequest.url}`);
  console.log(`Merge SHA: ${mergeSha}`);
  console.log(`Production deployment: ${deployment.deploymentUrl}`);
  console.log(`Production alias: ${smokeCheck.productionUrl}`);
  console.log(`Vercel deployment id: ${smokeCheck.deploymentId}`);
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
