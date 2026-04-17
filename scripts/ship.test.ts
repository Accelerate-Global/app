import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.fn();
const smokeCheckDeploymentMock = vi.fn();
const waitForGitHubDeploymentMock = vi.fn();
const waitForPullRequestChecksMock = vi.fn();
const waitForWorkflowRunMock = vi.fn();

vi.mock("./lib/command", () => ({
  runCommand: runCommandMock,
}));

vi.mock("./lib/release", () => ({
  smokeCheckDeployment: smokeCheckDeploymentMock,
  waitForGitHubDeployment: waitForGitHubDeploymentMock,
  waitForPullRequestChecks: waitForPullRequestChecksMock,
  waitForWorkflowRun: waitForWorkflowRunMock,
}));

describe("ship", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
    smokeCheckDeploymentMock.mockReset();
    waitForGitHubDeploymentMock.mockReset();
    waitForPullRequestChecksMock.mockReset();
    waitForWorkflowRunMock.mockReset();
  });

  it("waits for PR checks, then only release health after merge", async () => {
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
              ? {
                  baseRefName: "main",
                  headRefName: "codex/test-branch",
                  headRefOid: "head-sha",
                  mergeCommit: null,
                  number: 46,
                  state: "OPEN",
                  title: "[codex] test",
                  url: "https://github.com/Accelerate-Global/online/pull/46",
                }
              : {
                  baseRefName: "main",
                  headRefName: "codex/test-branch",
                  headRefOid: "head-sha",
                  mergeCommit: {
                    oid: "merge-sha",
                  },
                  number: 46,
                  state: "MERGED",
                  title: "[codex] test",
                  url: "https://github.com/Accelerate-Global/online/pull/46",
                },
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
    expect(waitForWorkflowRunMock).toHaveBeenCalledTimes(1);
    expect(waitForWorkflowRunMock).toHaveBeenCalledWith({
      workflowName: "Release Health",
      commitSha: "merge-sha",
    });
  });
});
