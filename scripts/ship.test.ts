import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.fn();
const waitForPullRequestChecksMock = vi.fn();
const waitForWorkflowRunMock = vi.fn();
const getTrackedFileTreeShaMock = vi.fn();
const loadVerificationReceiptMock = vi.fn();
const isVerificationSatisfiedMock = vi.fn();
let consoleLogMock: ReturnType<typeof vi.spyOn>;

vi.mock("./lib/command", () => ({
  runCommand: runCommandMock,
}));

vi.mock("./lib/release", () => ({
  waitForPullRequestChecks: waitForPullRequestChecksMock,
  waitForWorkflowRun: waitForWorkflowRunMock,
}));

vi.mock("./lib/verification-receipts", () => ({
  getTrackedFileTreeSha: getTrackedFileTreeShaMock,
  loadVerificationReceipt: loadVerificationReceiptMock,
  isVerificationSatisfied: isVerificationSatisfiedMock,
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

function buildPullRequestFiles(filePaths: string[]) {
  return [filePaths.map((filename) => ({ filename }))];
}

function installShipCommandMock(input: {
  pullRequestViews: Array<Record<string, unknown>>;
  pullRequestFiles?: string[];
  mergeError?: string;
}) {
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

    if (
      command === "gh" &&
      args[0] === "api" &&
      args[1] === "repos/{owner}/{repo}/pulls/46/files"
    ) {
      return {
        stdout: JSON.stringify(buildPullRequestFiles(input.pullRequestFiles ?? [])),
        stderr: "",
        exitCode: 0,
      };
    }

    if (command === "gh" && args[0] === "pr" && args[1] === "view") {
      const nextPullRequest =
        input.pullRequestViews[pullRequestViewCalls] ??
        input.pullRequestViews[input.pullRequestViews.length - 1];
      pullRequestViewCalls += 1;

      return {
        stdout: JSON.stringify(nextPullRequest),
        stderr: "",
        exitCode: 0,
      };
    }

    if (command === "gh" && args[0] === "pr" && args[1] === "merge") {
      if (input.mergeError) {
        throw new Error(input.mergeError);
      }

      return { stdout: "", stderr: "", exitCode: 0 };
    }

    if (command === "git" && ["switch", "pull", "branch", "remote"].includes(args[0] ?? "")) {
      return { stdout: "", stderr: "", exitCode: 0 };
    }

    throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
  });
}

describe("ship", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
    waitForPullRequestChecksMock.mockReset();
    waitForWorkflowRunMock.mockReset();
    getTrackedFileTreeShaMock.mockReset();
    loadVerificationReceiptMock.mockReset();
    isVerificationSatisfiedMock.mockReset();
    getTrackedFileTreeShaMock.mockResolvedValue("tree-sha");
    loadVerificationReceiptMock.mockResolvedValue({
      treeSha: "tree-sha",
      changedFiles: ["README.md"],
      commands: {
        "verify:ship:local": {
          passedAt: "2026-04-22T00:00:00.000Z",
        },
      },
    });
    isVerificationSatisfiedMock.mockReturnValue(true);
    consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for PR checks, seeds remote field sources when inputs changed, and finishes post-merge release verification", async () => {
    const { shipPullRequest } = await import("./ship");

    installShipCommandMock({
      pullRequestViews: [
        buildPullRequest(),
        buildPullRequest({
          mergeCommit: {
            oid: "merge-sha",
          },
          state: "MERGED",
        }),
      ],
      pullRequestFiles: ["src/data/field-sources/aggregate-1-field-mapping.csv"],
    });
    waitForPullRequestChecksMock.mockResolvedValue([]);
    waitForWorkflowRunMock.mockResolvedValue({
      workflowName: "Release Health",
    });

    await shipPullRequest({ prNumber: "46" });

    expect(waitForPullRequestChecksMock).toHaveBeenCalledWith({
      prNumber: "46",
      workflowNames: [
        "App Quality",
        "UI Smoke",
        "Database Security",
        "Dependency Audit",
      ],
    });
    expect(runCommandMock).toHaveBeenCalledWith(
      "pnpm",
      ["run", "field-sources:seed:remote"],
      expect.objectContaining({
        stdinMode: "ignore",
        timeoutMs: 300_000,
      }),
    );
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

    const stageMessages = consoleLogMock.mock.calls.map(
      (call: [unknown, ...unknown[]]) => String(call[0]),
    );

    expect(stageMessages).toContain("[ship] Ensuring the remote field-source registry is seeded...");
    expect(stageMessages).not.toContain(
      "[ship] Skipping remote field-source seeding; PR does not touch field-source seed inputs.",
    );
  });

  it("skips remote field-source seeding when the PR does not touch seed inputs", async () => {
    const { shipPullRequest } = await import("./ship");

    installShipCommandMock({
      pullRequestViews: [
        buildPullRequest({
          mergeCommit: {
            oid: "merge-sha",
          },
          state: "MERGED",
        }),
      ],
      pullRequestFiles: ["src/components/dashboard/dashboard-client.tsx"],
    });
    waitForWorkflowRunMock.mockResolvedValue({
      workflowName: "Release Health",
    });

    await shipPullRequest({ prNumber: "46" });

    expect(waitForPullRequestChecksMock).not.toHaveBeenCalled();
    expect(runCommandMock).not.toHaveBeenCalledWith(
      "pnpm",
      ["run", "field-sources:seed:remote"],
      expect.anything(),
    );

    const stageMessages = consoleLogMock.mock.calls.map(
      (call: [unknown, ...unknown[]]) => String(call[0]),
    );

    expect(stageMessages).toContain(
      "[ship] Skipping remote field-source seeding; PR does not touch field-source seed inputs.",
    );
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

  it("fails before merge work when the tracked tree lacks a verify:ship:local receipt", async () => {
    const { shipPullRequest } = await import("./ship");

    installShipCommandMock({
      pullRequestViews: [buildPullRequest()],
      pullRequestFiles: ["src/components/dashboard/dashboard-client.tsx"],
    });
    loadVerificationReceiptMock.mockResolvedValue(null);
    isVerificationSatisfiedMock.mockReturnValue(false);

    await expect(shipPullRequest({ prNumber: "46" })).rejects.toThrow(
      "Ship requires a current `pnpm run verify:ship:local` pass on this tracked tree before merge work begins.",
    );

    expect(waitForPullRequestChecksMock).not.toHaveBeenCalled();
    expect(runCommandMock).not.toHaveBeenCalledWith(
      "pnpm",
      ["run", "db:check-migration-drift"],
      expect.anything(),
    );
  });

  it("skips the verify:ship:local receipt gate when the PR is already merged", async () => {
    const { shipPullRequest } = await import("./ship");

    installShipCommandMock({
      pullRequestViews: [
        buildPullRequest({
          mergeCommit: {
            oid: "merge-sha",
          },
          state: "MERGED",
        }),
      ],
      pullRequestFiles: ["README.md"],
    });
    waitForWorkflowRunMock.mockResolvedValue({
      workflowName: "Release Health",
    });

    await shipPullRequest({ prNumber: "46" });

    expect(loadVerificationReceiptMock).not.toHaveBeenCalled();
    expect(waitForWorkflowRunMock).toHaveBeenCalledWith({
      workflowName: "Release Health",
      commitSha: "merge-sha",
    });
  });

  it("surfaces merge command failures", async () => {
    const { shipPullRequest } = await import("./ship");

    installShipCommandMock({
      pullRequestViews: [buildPullRequest()],
      pullRequestFiles: ["src/lib/field-sources.ts"],
      mergeError: "merge failed",
    });
    waitForPullRequestChecksMock.mockResolvedValue([]);

    await expect(shipPullRequest({ prNumber: "46" })).rejects.toThrow("merge failed");

    expect(waitForWorkflowRunMock).not.toHaveBeenCalled();
  });

  it("surfaces release workflow failures", async () => {
    const { shipPullRequest } = await import("./ship");

    installShipCommandMock({
      pullRequestViews: [
        buildPullRequest({
          mergeCommit: {
            oid: "merge-sha",
          },
          state: "MERGED",
        }),
      ],
      pullRequestFiles: ["README.md"],
    });
    waitForWorkflowRunMock.mockRejectedValue(new Error("release health failed"));

    await expect(shipPullRequest({ prNumber: "46" })).rejects.toThrow(
      "release health failed",
    );
  });
});
