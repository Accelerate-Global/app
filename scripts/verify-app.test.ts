import { describe, expect, it, vi } from "vitest";

import {
  parseVerifyAppArgs,
  runVerifyAppCommands,
  VERIFY_APP_TEST_ARGS,
} from "./verify-app";

describe("verify-app", () => {
  it("selects every task by default and explicit tasks otherwise", () => {
    expect(parseVerifyAppArgs([])).toEqual({
      lint: true,
      test: true,
      build: true,
    });
    expect(parseVerifyAppArgs(["--test"])).toEqual({
      lint: false,
      test: true,
      build: false,
    });
    expect(VERIFY_APP_TEST_ARGS).toEqual([
      "exec",
      "vitest",
      "run",
      "--maxWorkers=1",
    ]);
  });

  it("runs expensive verification tasks sequentially", async () => {
    let active = 0;
    let maximumActive = 0;
    const order: string[] = [];
    const task = (label: string) =>
      vi.fn(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        order.push(`${label}:start`);
        await Promise.resolve();
        order.push(`${label}:end`);
        active -= 1;
      });

    await runVerifyAppCommands([
      { label: "lint", run: task("lint") },
      { label: "test", run: task("test") },
      { label: "build", run: task("build") },
    ]);

    expect(maximumActive).toBe(1);
    expect(order).toEqual([
      "lint:start",
      "lint:end",
      "test:start",
      "test:end",
      "build:start",
      "build:end",
    ]);
  });

  it("reports failures after the remaining sequential tasks run", async () => {
    const finalTask = vi.fn().mockResolvedValue(undefined);

    await expect(
      runVerifyAppCommands([
        {
          label: "test",
          run: vi.fn().mockRejectedValue(new Error("tests failed")),
        },
        { label: "build", run: finalTask },
      ]),
    ).rejects.toThrow("test: tests failed");
    expect(finalTask).toHaveBeenCalledOnce();
  });
});
