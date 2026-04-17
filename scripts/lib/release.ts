import { parseDeploymentMarkup } from "@/lib/release-process";

import { delay, runCommand } from "./command";

const GH_COMMAND_TIMEOUT_MS = 30_000;
const FETCH_TIMEOUT_MS = 30_000;

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

function logObservedState(lastState: string | null, nextState: string) {
  if (lastState !== nextState) {
    console.log(`[release] ${nextState}`);
    return nextState;
  }

  return lastState;
}

function describeLastObservedState(lastState: string | null) {
  return lastState ?? "No remote state was observed.";
}

function formatRequiredCheckState(input: {
  prNumber: string;
  requiredChecks: Array<{
    workflowName: string;
    check: GitHubPullRequestCheck | undefined;
  }>;
}) {
  const summary = input.requiredChecks
    .map(({ workflowName, check }) => `${workflowName}=${check?.bucket ?? "missing"}`)
    .join(", ");

  return `PR #${input.prNumber} checks: ${summary}`;
}

function formatWorkflowState(input: {
  workflowName: string;
  commitSha: string;
  run: GitHubWorkflowRun | null;
}) {
  if (!input.run) {
    return `${input.workflowName} for ${input.commitSha}: awaiting workflow run`;
  }

  return `${input.workflowName} for ${input.commitSha}: ${input.run.status}/${input.run.conclusion ?? "pending"} (${input.run.url})`;
}

function formatDeploymentState(input: {
  commitSha: string;
  deployment: GitHubDeployment | null;
  status: GitHubDeploymentStatus | null;
}) {
  if (!input.deployment) {
    return `Production deployment for ${input.commitSha}: awaiting deployment record`;
  }

  const deploymentUrl = input.status?.target_url ?? input.status?.environment_url ?? "pending";

  return [
    `Production deployment for ${input.commitSha}:`,
    `id=${input.deployment.id}`,
    `state=${input.status?.state ?? "pending"}`,
    `url=${deploymentUrl}`,
  ].join(" ");
}

async function ghApi<T>(path: string) {
  const { stdout } = await runCommand("gh", ["api", path], {
    quiet: true,
    stdinMode: "ignore",
    timeoutMs: GH_COMMAND_TIMEOUT_MS,
  });
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
    {
      quiet: true,
      stdinMode: "ignore",
      timeoutMs: GH_COMMAND_TIMEOUT_MS,
    },
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
      stdinMode: "ignore",
      timeoutMs: GH_COMMAND_TIMEOUT_MS,
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
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
  let lastObservedState: string | null = null;

  for (;;) {
    const run = getLatestRun(await ghRunList(options.workflowName, options.commitSha));
    const observedState = formatWorkflowState({
      workflowName: options.workflowName,
      commitSha: options.commitSha,
      run,
    });

    lastObservedState = logObservedState(lastObservedState, observedState);

    if (run) {
      if (run.status === "completed") {
        if (run.conclusion !== "success") {
          throw new Error(
            `${options.workflowName} failed for ${options.commitSha}. ${describeLastObservedState(lastObservedState)}`,
          );
        }

        return run;
      }
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `Timed out waiting for ${options.workflowName} on ${options.commitSha}. ${describeLastObservedState(lastObservedState)}`,
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
  let lastObservedState: string | null = null;

  for (;;) {
    const checks = await ghPullRequestChecks(options.prNumber);
    const requiredChecks = options.workflowNames.map((workflowName) => ({
      workflowName,
      check: checks.find((check) => check.workflow === workflowName),
    }));
    const observedState = formatRequiredCheckState({
      prNumber: options.prNumber,
      requiredChecks,
    });

    lastObservedState = logObservedState(lastObservedState, observedState);
    const failedCheck = requiredChecks.find(
      ({ check }) => check && ["fail", "cancel"].includes(check.bucket),
    );

    if (failedCheck?.check) {
      throw new Error(
        `${failedCheck.workflowName} failed for PR #${options.prNumber}. ${describeLastObservedState(lastObservedState)} (${failedCheck.check.link})`,
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
          .join(", ")}. ${describeLastObservedState(lastObservedState)}`,
      );
    }

    await delay(pollMs);
  }
}

export async function waitForGitHubDeployment(options: WaitForDeploymentOptions) {
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const pollMs = options.pollMs ?? 5000;
  const startedAt = Date.now();
  let lastObservedState: string | null = null;

  for (;;) {
    const deployments = await ghApi<GitHubDeployment[]>(
      `repos/Accelerate-Global/online/deployments?sha=${options.commitSha}`,
    );
    const deployment = getLatestDeployment(deployments);
    const status = deployment
      ? getLatestDeploymentStatus(
          await ghApi<GitHubDeploymentStatus[]>(
            `repos/Accelerate-Global/online/deployments/${deployment.id}/statuses`,
          ),
        )
      : null;
    const observedState = formatDeploymentState({
      commitSha: options.commitSha,
      deployment,
      status,
    });

    lastObservedState = logObservedState(lastObservedState, observedState);

    if (deployment) {
      if (status?.state === "success" && status.environment_url) {
        return {
          deployment,
          status,
          deploymentUrl: status.environment_url,
        };
      }

      if (status && ["error", "failure", "inactive"].includes(status.state)) {
        throw new Error(
          `GitHub deployment for ${options.commitSha} failed. ${describeLastObservedState(lastObservedState)}`,
        );
      }
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        `Timed out waiting for a production deployment for ${options.commitSha}. ${describeLastObservedState(lastObservedState)}`,
      );
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
