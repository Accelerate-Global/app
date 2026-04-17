import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.fn();

vi.mock("./command", () => ({
  delay: vi.fn(() => Promise.resolve()),
  runCommand: runCommandMock,
}));

describe("release", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for the current PR check state and logs only state transitions", async () => {
    const { waitForPullRequestChecks } = await import("./release");

    runCommandMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            bucket: "pending",
            link: "https://example.com/ui-smoke",
            name: "ui-smoke",
            state: "PENDING",
            workflow: "UI Smoke",
          },
          {
            bucket: "pass",
            link: "https://example.com/app-quality",
            name: "app-quality",
            state: "SUCCESS",
            workflow: "App Quality",
          },
          {
            bucket: "pass",
            link: "https://example.com/database-security",
            name: "database-security",
            state: "SUCCESS",
            workflow: "Database Security",
          },
        ]),
        stderr: "",
        exitCode: 8,
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            bucket: "pending",
            link: "https://example.com/ui-smoke",
            name: "ui-smoke",
            state: "PENDING",
            workflow: "UI Smoke",
          },
          {
            bucket: "pass",
            link: "https://example.com/app-quality",
            name: "app-quality",
            state: "SUCCESS",
            workflow: "App Quality",
          },
          {
            bucket: "pass",
            link: "https://example.com/database-security",
            name: "database-security",
            state: "SUCCESS",
            workflow: "Database Security",
          },
        ]),
        stderr: "",
        exitCode: 8,
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            bucket: "pass",
            link: "https://example.com/ui-smoke",
            name: "ui-smoke",
            state: "SUCCESS",
            workflow: "UI Smoke",
          },
          {
            bucket: "pass",
            link: "https://example.com/app-quality",
            name: "app-quality",
            state: "SUCCESS",
            workflow: "App Quality",
          },
          {
            bucket: "pass",
            link: "https://example.com/database-security",
            name: "database-security",
            state: "SUCCESS",
            workflow: "Database Security",
          },
        ]),
        stderr: "",
        exitCode: 0,
      });

    await expect(
      waitForPullRequestChecks({
        prNumber: "46",
        workflowNames: [
          "App Quality",
          "UI Smoke",
          "Database Security",
        ],
        pollMs: 0,
      }),
    ).resolves.toHaveLength(3);
    expect(runCommandMock).toHaveBeenCalledWith(
      "gh",
      ["pr", "checks", "46", "--json", "name,workflow,bucket,state,link"],
      expect.objectContaining({
        allowFailure: true,
        quiet: true,
        stdinMode: "ignore",
        timeoutMs: 30_000,
      }),
    );
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenNthCalledWith(
      1,
      "[release] PR #46 checks: App Quality=pass, UI Smoke=pending, Database Security=pass",
    );
    expect(console.log).toHaveBeenNthCalledWith(
      2,
      "[release] PR #46 checks: App Quality=pass, UI Smoke=pass, Database Security=pass",
    );
  });

  it("includes the last observed check state in PR check timeouts", async () => {
    const { waitForPullRequestChecks } = await import("./release");
    const dateNowSpy = vi.spyOn(Date, "now");

    dateNowSpy.mockReturnValueOnce(0).mockReturnValueOnce(1);
    runCommandMock.mockResolvedValue({
      stdout: JSON.stringify([
        {
          bucket: "pending",
          link: "https://example.com/ui-smoke",
          name: "ui-smoke",
          state: "PENDING",
          workflow: "UI Smoke",
        },
        {
          bucket: "pass",
          link: "https://example.com/app-quality",
          name: "app-quality",
          state: "SUCCESS",
          workflow: "App Quality",
        },
        {
          bucket: "pass",
          link: "https://example.com/database-security",
          name: "database-security",
          state: "SUCCESS",
          workflow: "Database Security",
        },
      ]),
      stderr: "",
      exitCode: 8,
    });

    await expect(
      waitForPullRequestChecks({
        prNumber: "46",
        workflowNames: [
          "App Quality",
          "UI Smoke",
          "Database Security",
        ],
        timeoutMs: 0,
        pollMs: 0,
      }),
    ).rejects.toThrow(
      "Timed out waiting for PR #46 checks: UI Smoke. PR #46 checks: App Quality=pass, UI Smoke=pending, Database Security=pass",
    );
  });

  it("includes the workflow run URL on workflow failures", async () => {
    const { waitForWorkflowRun } = await import("./release");

    runCommandMock.mockResolvedValue({
      stdout: JSON.stringify([
        {
          databaseId: 123,
          name: "Release Health",
          status: "completed",
          conclusion: "failure",
          url: "https://example.com/release-health",
          workflowName: "Release Health",
        },
      ]),
      stderr: "",
      exitCode: 0,
    });

    await expect(
      waitForWorkflowRun({
        workflowName: "Release Health",
        commitSha: "merge-sha",
      }),
    ).rejects.toThrow(
      "Release Health failed for merge-sha. Release Health for merge-sha: completed/failure (https://example.com/release-health)",
    );
  });

  it("includes the last observed workflow state in workflow timeouts", async () => {
    const { waitForWorkflowRun } = await import("./release");
    const dateNowSpy = vi.spyOn(Date, "now");

    dateNowSpy.mockReturnValueOnce(0).mockReturnValueOnce(1);
    runCommandMock.mockResolvedValue({
      stdout: JSON.stringify([
        {
          databaseId: 123,
          name: "Release Health",
          status: "in_progress",
          conclusion: null,
          url: "https://example.com/release-health",
          workflowName: "Release Health",
        },
      ]),
      stderr: "",
      exitCode: 0,
    });

    await expect(
      waitForWorkflowRun({
        workflowName: "Release Health",
        commitSha: "merge-sha",
        timeoutMs: 0,
        pollMs: 0,
      }),
    ).rejects.toThrow(
      "Timed out waiting for Release Health on merge-sha. Release Health for merge-sha: in_progress/pending (https://example.com/release-health)",
    );
  });

  it("includes deployment id and status when deployment polling fails", async () => {
    const { waitForGitHubDeployment } = await import("./release");

    runCommandMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            id: 42,
            environment: "Production",
            original_environment: "Production",
            created_at: "2026-04-17T15:33:47Z",
            statuses_url: "https://api.github.com/statuses/42",
          },
        ]),
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            state: "failure",
            environment_url: "https://online.example.vercel.app",
            target_url: "https://online.example.vercel.app",
            created_at: "2026-04-17T15:33:48Z",
          },
        ]),
        stderr: "",
        exitCode: 0,
      });

    await expect(
      waitForGitHubDeployment({
        commitSha: "merge-sha",
      }),
    ).rejects.toThrow(
      "GitHub deployment for merge-sha failed. Production deployment for merge-sha: id=42 state=failure url=https://online.example.vercel.app",
    );
  });

  it("includes deployment id and last status in deployment timeouts", async () => {
    const { waitForGitHubDeployment } = await import("./release");
    const dateNowSpy = vi.spyOn(Date, "now");

    dateNowSpy.mockReturnValueOnce(0).mockReturnValueOnce(1);
    runCommandMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            id: 42,
            environment: "Production",
            original_environment: "Production",
            created_at: "2026-04-17T15:33:47Z",
            statuses_url: "https://api.github.com/statuses/42",
          },
        ]),
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            state: "in_progress",
            environment_url: "https://online.example.vercel.app",
            target_url: "https://online.example.vercel.app",
            created_at: "2026-04-17T15:33:48Z",
          },
        ]),
        stderr: "",
        exitCode: 0,
      });

    await expect(
      waitForGitHubDeployment({
        commitSha: "merge-sha",
        timeoutMs: 0,
        pollMs: 0,
      }),
    ).rejects.toThrow(
      "Timed out waiting for a production deployment for merge-sha. Production deployment for merge-sha: id=42 state=in_progress url=https://online.example.vercel.app",
    );
  });
});
