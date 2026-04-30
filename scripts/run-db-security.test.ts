import { beforeEach, describe, expect, it, vi } from "vitest";

import { runDbSecurity } from "./run-db-security";

const { delayMock, runCommandMock } = vi.hoisted(() => ({
  delayMock: vi.fn(),
  runCommandMock: vi.fn(),
}));

vi.mock("./lib/command", () => ({
  delay: delayMock,
  runCommand: runCommandMock,
}));

function commandResult(overrides: Partial<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> = {}) {
  return {
    stdout: "",
    stderr: "",
    exitCode: 0,
    ...overrides,
  };
}

describe("runDbSecurity", () => {
  beforeEach(() => {
    delayMock.mockReset();
    delayMock.mockResolvedValue(undefined);
    runCommandMock.mockReset();
    runCommandMock.mockResolvedValue(commandResult());
  });

  it("starts Supabase, resets the local database, and runs security checks", async () => {
    await runDbSecurity();

    expect(runCommandMock.mock.calls).toEqual([
      ["supabase", ["start", "--ignore-health-check"], { allowFailure: true }],
      [
        "supabase",
        ["db", "reset", "--local", "--no-seed", "--yes"],
        { allowFailure: true },
      ],
      ["pnpm", ["run", "db:security:started"]],
    ]);
  });

  it("continues after a Supabase start health-check race once status settles", async () => {
    runCommandMock
      .mockResolvedValueOnce(commandResult({
        exitCode: 1,
        stderr: "supabase_storage_online container is not ready: starting",
      }))
      .mockResolvedValueOnce(commandResult({
        exitCode: 1,
        stderr: "supabase start is already running.",
      }))
      .mockResolvedValueOnce(commandResult())
      .mockResolvedValueOnce(commandResult())
      .mockResolvedValueOnce(commandResult());

    await runDbSecurity();

    expect(runCommandMock.mock.calls).toEqual([
      ["supabase", ["start", "--ignore-health-check"], { allowFailure: true }],
      [
        "supabase",
        ["status"],
        { allowFailure: true, quiet: true, stdinMode: "ignore" },
      ],
      [
        "supabase",
        ["status"],
        { allowFailure: true, quiet: true, stdinMode: "ignore" },
      ],
      [
        "supabase",
        ["db", "reset", "--local", "--no-seed", "--yes"],
        { allowFailure: true },
      ],
      ["pnpm", ["run", "db:security:started"]],
    ]);
    expect(delayMock).toHaveBeenCalledWith(2_000);
  });

  it("continues after a post-reset Supabase container restart race", async () => {
    runCommandMock
      .mockResolvedValueOnce(commandResult())
      .mockResolvedValueOnce(commandResult({
        exitCode: 1,
        stdout: "Restarting containers...",
        stderr: "failed to inspect container health: No such container: supabase_storage_online",
      }))
      .mockResolvedValueOnce(commandResult())
      .mockResolvedValueOnce(commandResult());

    await runDbSecurity();

    expect(runCommandMock.mock.calls).toEqual([
      ["supabase", ["start", "--ignore-health-check"], { allowFailure: true }],
      [
        "supabase",
        ["db", "reset", "--local", "--no-seed", "--yes"],
        { allowFailure: true },
      ],
      [
        "supabase",
        ["status"],
        { allowFailure: true, quiet: true, stdinMode: "ignore" },
      ],
      ["pnpm", ["run", "db:security:started"]],
    ]);
  });

  it("fails non-lifecycle Supabase errors without running checks", async () => {
    runCommandMock.mockResolvedValueOnce(commandResult({
      exitCode: 1,
      stderr: "migration failed",
    }));

    await expect(runDbSecurity()).rejects.toThrow("Supabase start failed.");

    expect(runCommandMock.mock.calls).toEqual([
      ["supabase", ["start", "--ignore-health-check"], { allowFailure: true }],
    ]);
  });
});
