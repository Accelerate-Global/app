import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.fn();

vi.mock("./command", () => ({
  delay: vi.fn(() => Promise.resolve()),
  runCommand: runCommandMock,
}));

describe("release", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
  });

  it("waits for the current PR check state instead of workflow runs by head sha", async () => {
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
      }),
    );
  });
});
