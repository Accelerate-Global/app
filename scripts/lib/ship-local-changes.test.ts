import { beforeEach, describe, expect, it, vi } from "vitest";

const { runCommandMock } = vi.hoisted(() => ({
  runCommandMock: vi.fn(),
}));

vi.mock("./command", () => ({
  runCommand: runCommandMock,
}));

describe("ship-local-changes", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
  });

  it("refreshes origin/main before diffing and returns the canonical ship-local range", async () => {
    const { getShipLocalDiff } = await import("./ship-local-changes");

    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (
        command === "git" &&
        args.join(" ") === "fetch --quiet --no-tags origin refs/heads/main:refs/remotes/origin/main"
      ) {
        return {
          stdout: "",
          stderr: "",
          exitCode: 0,
        };
      }

      if (
        command === "git" &&
        args.join(" ") === "diff --name-only -z origin/main...HEAD"
      ) {
        return {
          stdout: "scripts/ship.ts\0scripts/verify-ship-local.ts\0",
          stderr: "",
          exitCode: 0,
        };
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });

    await expect(getShipLocalDiff()).resolves.toEqual({
      baseRef: "origin/main",
      headRef: "HEAD",
      changedFiles: ["scripts/ship.ts", "scripts/verify-ship-local.ts"],
    });
    expect(runCommandMock.mock.calls).toEqual([
      [
        "git",
        [
          "fetch",
          "--quiet",
          "--no-tags",
          "origin",
          "refs/heads/main:refs/remotes/origin/main",
        ],
        expect.objectContaining({
          quiet: true,
          stdinMode: "ignore",
          timeoutMs: 30_000,
        }),
      ],
      [
        "git",
        ["diff", "--name-only", "-z", "origin/main...HEAD"],
        expect.objectContaining({
          quiet: true,
          stdinMode: "ignore",
          timeoutMs: 30_000,
        }),
      ],
    ]);
  });

  it("surfaces fetch failures without attempting the diff", async () => {
    const { getShipLocalDiff } = await import("./ship-local-changes");

    runCommandMock.mockRejectedValue(new Error("fetch failed"));

    await expect(getShipLocalDiff()).rejects.toThrow("fetch failed");
    expect(runCommandMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces diff failures after refreshing origin/main", async () => {
    const { getShipLocalDiff } = await import("./ship-local-changes");

    runCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (
        command === "git" &&
        args.join(" ") === "fetch --quiet --no-tags origin refs/heads/main:refs/remotes/origin/main"
      ) {
        return {
          stdout: "",
          stderr: "",
          exitCode: 0,
        };
      }

      if (
        command === "git" &&
        args.join(" ") === "diff --name-only -z origin/main...HEAD"
      ) {
        throw new Error("diff failed");
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });

    await expect(getShipLocalDiff()).rejects.toThrow("diff failed");
    expect(runCommandMock).toHaveBeenCalledTimes(2);
  });
});
