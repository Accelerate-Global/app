import { beforeEach, describe, expect, it, vi } from "vitest";

const { rmMock, runCommandMock } = vi.hoisted(() => ({
  rmMock: vi.fn(),
  runCommandMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  rm: rmMock,
}));

vi.mock("./lib/command", () => ({
  runCommand: runCommandMock,
}));

describe("typecheck", () => {
  beforeEach(() => {
    rmMock.mockReset();
    runCommandMock.mockReset();
    rmMock.mockResolvedValue(undefined);
    runCommandMock.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
  });

  it("cleans generated Next route types before regenerating and typechecking", async () => {
    const { runTypecheck } = await import("./typecheck");

    await runTypecheck();

    expect(rmMock.mock.calls).toEqual([
      [
        `${process.cwd()}/.next/types`,
        {
          recursive: true,
          force: true,
        },
      ],
      [
        `${process.cwd()}/.next/dev/types`,
        {
          recursive: true,
          force: true,
        },
      ],
    ]);
    expect(runCommandMock.mock.calls).toEqual([
      [
        "pnpm",
        ["exec", "next", "typegen"],
        {
          stdinMode: "ignore",
        },
      ],
      [
        "pnpm",
        ["exec", "tsc", "--noEmit"],
        {
          stdinMode: "ignore",
        },
      ],
    ]);
  });
});
