import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.fn();
const smokeCheckDeploymentMock = vi.fn();
const waitForGitHubDeploymentMock = vi.fn();
const waitForPullRequestChecksMock = vi.fn();
const waitForWorkflowRunMock = vi.fn();
let consoleLogMock: ReturnType<typeof vi.spyOn>;

vi.mock("./lib/command", () => ({
  runCommand: runCommandMock,
}));

vi.mock("./lib/release", () => ({
  smokeCheckDeployment: smokeCheckDeploymentMock,
  waitForGitHubDeployment: waitForGitHubDeploymentMock,
  waitForPullRequestChecks: waitForPullRequestChecksMock,
  waitForWorkflowRun: waitForWorkflowRunMock,
}));

function buildPullRequest(overrides: Record<string, unknown> = {}) {
  return {
    baseRefName: "main",
    headRefName: "codex/test-branch",
    headRefOid: "head-sha",
    mergeCommit: null,
    number: 46,
    state: "OPEN",
    title: "[codex] test",
    url: "https://github.com/Accelerate-Global/online/pull/46",
    ...overrides,
  };
}

describe("ship", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
    smokeCheckDeploymentMock.mockReset();
    waitForGitHubDeploymentMock.mockReset();
    waitForPullRequestChecksMock.mockReset();
    waitForWorkflowRunMock.mockReset();
    consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for PR checks, merges, and finishes post-merge release verification", async () => {
    const { shipPullRequest } = await import("./ship");
    let pullRequestViewCalls = 0;

    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === "git" && args[0] === "status") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run db:check-migration-drift") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run field-sources:seed:remote") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "gh" && args[0] === "pr" && args[1] === "view") {
        pullRequestViewCalls += 1;

        return {
          stdout: JSON.stringify(
            pullRequestViewCalls === 1
              ? buildPullRequest()
              : buildPullRequest({
                  mergeCommit: {
                    oid: "merge-sha",
                  },
                  state: "MERGED",
                }),
          ),
          stderr: "",
          exitCode: 0,
        };
      }

      if (command === "gh" && args[0] === "pr" && args[1] === "merge") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "git" && ["switch", "pull", "branch", "remote"].includes(args[0] ?? "")) {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });
    waitForPullRequestChecksMock.mockResolvedValue([]);
    waitForWorkflowRunMock.mockResolvedValue({
      workflowName: "Release Health",
    });
    waitForGitHubDeploymentMock.mockResolvedValue({
      deploymentUrl: "https://online.example.vercel.app",
    });
    smokeCheckDeploymentMock.mockResolvedValue({
      deploymentId: "dpl_123",
      productionUrl: "https://data.accelerateglobal.org",
    });

    await shipPullRequest({ prNumber: "46" });

    expect(waitForPullRequestChecksMock).toHaveBeenCalledWith({
      prNumber: "46",
      workflowNames: [
        "App Quality",
        "UI Smoke",
        "Database Security",
      ],
    });
    expect(runCommandMock).toHaveBeenCalledWith(
      "gh",
      [
        "pr",
        "merge",
        "46",
        "--merge",
        "--delete-branch",
        "--match-head-commit",
        "head-sha",
      ],
      expect.objectContaining({
        stdinMode: "ignore",
        timeoutMs: 30_000,
      }),
    );
    expect(waitForWorkflowRunMock).toHaveBeenCalledWith({
      workflowName: "Release Health",
      commitSha: "merge-sha",
    });
    expect(waitForGitHubDeploymentMock).toHaveBeenCalledWith({
      commitSha: "merge-sha",
    });
    const stageMessages = consoleLogMock.mock.calls.map(
      (call: [unknown, ...unknown[]]) => String(call[0]),
    );
    const remoteSeedStageIndex = stageMessages.indexOf(
      "[ship] Ensuring the remote field-source registry is seeded...",
    );

    expect(remoteSeedStageIndex).toBeGreaterThanOrEqual(0);
    expect(stageMessages[remoteSeedStageIndex + 1]).toBe("[ship] Looking up PR #46...");
  });

  it("resumes post-merge verification when the PR is already merged", async () => {
    const { shipPullRequest } = await import("./ship");

    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === "git" && args[0] === "status") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run db:check-migration-drift") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run field-sources:seed:remote") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "gh" && args[0] === "pr" && args[1] === "view") {
        return {
          stdout: JSON.stringify(
            buildPullRequest({
              mergeCommit: {
                oid: "merge-sha",
              },
              state: "MERGED",
            }),
          ),
          stderr: "",
          exitCode: 0,
        };
      }

      if (command === "gh" && args[0] === "pr" && args[1] === "merge") {
        throw new Error("merge should not run");
      }

      if (command === "git" && ["switch", "pull", "branch", "remote"].includes(args[0] ?? "")) {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });
    waitForWorkflowRunMock.mockResolvedValue({
      workflowName: "Release Health",
    });
    waitForGitHubDeploymentMock.mockResolvedValue({
      deploymentUrl: "https://online.example.vercel.app",
    });
    smokeCheckDeploymentMock.mockResolvedValue({
      deploymentId: "dpl_123",
      productionUrl: "https://data.accelerateglobal.org",
    });

    await shipPullRequest({ prNumber: "46" });

    expect(waitForPullRequestChecksMock).not.toHaveBeenCalled();
    expect(waitForWorkflowRunMock).toHaveBeenCalledWith({
      workflowName: "Release Health",
      commitSha: "merge-sha",
    });
  });

  it("fails early when the git worktree is dirty", async () => {
    const { shipPullRequest } = await import("./ship");

    runCommandMock.mockResolvedValue({
      stdout: " M scripts/ship.ts\n",
      stderr: "",
      exitCode: 0,
    });

    await expect(shipPullRequest({ prNumber: "46" })).rejects.toThrow(
      "Ship requires a clean git worktree.",
    );

    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(waitForPullRequestChecksMock).not.toHaveBeenCalled();
  });

  it("surfaces merge command failures", async () => {
    const { shipPullRequest } = await import("./ship");

    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === "git" && args[0] === "status") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run db:check-migration-drift") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run field-sources:seed:remote") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "gh" && args[0] === "pr" && args[1] === "view") {
        return {
          stdout: JSON.stringify(buildPullRequest()),
          stderr: "",
          exitCode: 0,
        };
      }

      if (command === "gh" && args[0] === "pr" && args[1] === "merge") {
        throw new Error("merge failed");
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });
    waitForPullRequestChecksMock.mockResolvedValue([]);

    await expect(shipPullRequest({ prNumber: "46" })).rejects.toThrow("merge failed");

    expect(waitForWorkflowRunMock).not.toHaveBeenCalled();
  });

  it("surfaces release workflow failures", async () => {
    const { shipPullRequest } = await import("./ship");

    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === "git" && args[0] === "status") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run db:check-migration-drift") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run field-sources:seed:remote") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "gh" && args[0] === "pr" && args[1] === "view") {
        return {
          stdout: JSON.stringify(
            buildPullRequest({
              mergeCommit: {
                oid: "merge-sha",
              },
              state: "MERGED",
            }),
          ),
          stderr: "",
          exitCode: 0,
        };
      }

      if (command === "git" && ["switch", "pull", "branch", "remote"].includes(args[0] ?? "")) {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });
    waitForWorkflowRunMock.mockRejectedValue(new Error("release health failed"));

    await expect(shipPullRequest({ prNumber: "46" })).rejects.toThrow(
      "release health failed",
    );

    expect(waitForGitHubDeploymentMock).not.toHaveBeenCalled();
  });

  it("surfaces production deployment failures", async () => {
    const { shipPullRequest } = await import("./ship");

    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === "git" && args[0] === "status") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run db:check-migration-drift") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "pnpm" && args.join(" ") === "run field-sources:seed:remote") {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      if (command === "gh" && args[0] === "pr" && args[1] === "view") {
        return {
          stdout: JSON.stringify(
            buildPullRequest({
              mergeCommit: {
                oid: "merge-sha",
              },
              state: "MERGED",
            }),
          ),
          stderr: "",
          exitCode: 0,
        };
      }

      if (command === "git" && ["switch", "pull", "branch", "remote"].includes(args[0] ?? "")) {
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });
    waitForWorkflowRunMock.mockResolvedValue({
      workflowName: "Release Health",
    });
    waitForGitHubDeploymentMock.mockRejectedValue(new Error("deployment failed"));

    await expect(shipPullRequest({ prNumber: "46" })).rejects.toThrow(
      "deployment failed",
    );

    expect(smokeCheckDeploymentMock).not.toHaveBeenCalled();
  });
});
