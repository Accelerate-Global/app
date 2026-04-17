import { parseDeploymentMarkup } from "@/lib/release-process";

import { delay, runCommand } from "./command";

type GitHubWorkflowRun = {
  databaseId: number;
  name: string;
  status: string;
  conclusion: string | null;
  url: string;
  workflowName: string;
};

type GitHubPullRequestCheck = {
  bucket: "pass" | "fail" | "pending" | "skipping" | "cancel";
  link: string;
  name: string;
  state: string;
  workflow?: string;
};

type GitHubDeployment = {
  id: number;
  environment: string;
  original_environment?: string;
  created_at: string;
  statuses_url: string;
};

type GitHubDeploymentStatus = {
  state: string;
  environment_url?: string;
  target_url?: string;
  created_at: string;
};

type WaitForWorkflowOptions = {
  workflowName: string;
  commitSha: string;
  timeoutMs?: number;
  pollMs?: number;
};

type WaitForDeploymentOptions = {
  commitSha: string;
  timeoutMs?: number;
  pollMs?: number;
};

type SmokeCheckOptions = {
  productionUrl: string;
  expectedTitle: string;
  timeoutMs?: number;
  pollMs?: number;
};

async function ghApi<T>(path: string) {
  const { stdout } = await runCommand("gh", ["api", path], { quiet: true });
  return JSON.parse(stdout) as T;
}

async function ghRunList(workflowName: string, commitSha: string) {
  const { stdout } = await runCommand(
    "gh",
    [
      "run",
      "list",
      "--workflow",
      workflowName,
      "--commit",
      commitSha,
      "--json",
      "databaseId,name,status,conclusion,url,workflowName",
      "--limit",
      "10",
    ],
    { quiet: true },
  );

  return JSON.parse(stdout) as GitHubWorkflowRun[];
}

async function ghPullRequestChecks(prNumber: string) {
  const result = await runCommand(
    "gh",
    [
      "pr",
      "checks",
      prNumber,
      "--json",
      "name,workflow,bucket,state,link",
    ],
    {
      quiet: true,
      allowFailure: true,
    },
  );

  if (![0, 8].includes(result.exitCode)) {
    throw new Error(result.stderr.trim() || `gh pr checks failed for PR #${prNumber}.`);
  }

  return JSON.parse(result.stdout) as GitHubPullRequestCheck[];
}

function getLatestRun(runs: GitHubWorkflowRun[]) {
  return [...runs].sort((left, right) => right.databaseId - left.databaseId)[0] ?? null;
}

function getLatestDeployment(deployments: GitHubDeployment[]) {
  return [...deployments]
    .filter((deployment) =>
      [deployment.environment, deployment.original_environment]
        .filter(Boolean)
        .some((environment) => environment === "Production"),
    )
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )[0] ?? null;
}

function getLatestDeploymentStatus(statuses: GitHubDeploymentStatus[]) {
  return [...statuses].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  )[0] ?? null;
}

async function fetchMarkupInfo(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "accelerate-global-release-health",
    },
  });

  if (!response.ok) {
    throw new Error(`Smoke check failed for ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return parseDeploymentMarkup(html);
}

export async function waitForWorkflowRun(options: WaitForWorkflowOptions) {
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const pollMs = options.pollMs ?? 5000;
  const startedAt = Date.now();

  for (;;) {
    const run = getLatestRun(
      await ghRunList(options.workflowName, options.commitSha),
    );

    if (run) {
      if (run.status === "completed") {
        if (run.conclusion !== "success") {
          throw new Error(
            `${options.workflowName} failed for ${options.commitSha}: ${run.conclusion} (${run.url})`,
          );
        }

        return run;
      }
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `Timed out waiting for ${options.workflowName} on ${options.commitSha}.`,
      );
    }

    await delay(pollMs);
  }
}

export async function waitForPullRequestChecks(options: {
  prNumber: string;
  workflowNames: string[];
  timeoutMs?: number;
  pollMs?: number;
}) {
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const pollMs = options.pollMs ?? 5000;
  const startedAt = Date.now();

  for (;;) {
    const checks = await ghPullRequestChecks(options.prNumber);
    const requiredChecks = options.workflowNames.map((workflowName) => ({
      workflowName,
      check: checks.find((check) => check.workflow === workflowName),
    }));
    const failedCheck = requiredChecks.find(
      ({ check }) => check && ["fail", "cancel"].includes(check.bucket),
    );

    if (failedCheck?.check) {
      throw new Error(
        `${failedCheck.workflowName} failed for PR #${options.prNumber}: ${failedCheck.check.link}`,
      );
    }

    const pendingChecks = requiredChecks.filter(
      ({ check }) =>
        !check || !["pass", "skipping"].includes(check.bucket),
    );

    if (pendingChecks.length === 0) {
      return checks;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `Timed out waiting for PR #${options.prNumber} checks: ${pendingChecks
          .map(({ workflowName }) => workflowName)
          .join(", ")}.`,
      );
    }

    await delay(pollMs);
  }
}

export async function waitForGitHubDeployment(options: WaitForDeploymentOptions) {
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const pollMs = options.pollMs ?? 5000;
  const startedAt = Date.now();

  for (;;) {
    const deployments = await ghApi<GitHubDeployment[]>(
      `repos/Accelerate-Global/online/deployments?sha=${options.commitSha}`,
    );
    const deployment = getLatestDeployment(deployments);

    if (deployment) {
      const statuses = await ghApi<GitHubDeploymentStatus[]>(
        `repos/Accelerate-Global/online/deployments/${deployment.id}/statuses`,
      );
      const status = getLatestDeploymentStatus(statuses);

      if (status?.state === "success" && status.environment_url) {
        return {
          deployment,
          status,
          deploymentUrl: status.environment_url,
        };
      }

      if (status && ["error", "failure", "inactive"].includes(status.state)) {
        throw new Error(
          `GitHub deployment for ${options.commitSha} failed with status "${status.state}".`,
        );
      }
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for a production deployment for ${options.commitSha}.`);
    }

    await delay(pollMs);
  }
}

export async function smokeCheckDeployment(options: SmokeCheckOptions) {
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const pollMs = options.pollMs ?? 5000;
  const startedAt = Date.now();

  for (;;) {
    const productionMarkup = await fetchMarkupInfo(options.productionUrl);

    if (productionMarkup.title === options.expectedTitle && productionMarkup.deploymentId) {
      return {
        deploymentId: productionMarkup.deploymentId,
        productionUrl: options.productionUrl,
      };
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        [
          `Production page title: ${productionMarkup.title ?? "missing"}.`,
          `Production page dpl id: ${productionMarkup.deploymentId ?? "missing"}.`,
          `Timed out waiting for ${options.productionUrl} to serve the expected release.`,
        ].join(" "),
      );
    }

    await delay(pollMs);
  }
}
