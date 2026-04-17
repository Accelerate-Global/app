import { describe, expect, it } from "vitest";

import { runCommand } from "./command";

describe("command", () => {
  it("does not inherit stdin when stdinMode is ignore", async () => {
    const result = await runCommand(
      "node",
      [
        "-e",
        "process.stdin.once('end', () => process.stdout.write('stdin-closed')); process.stdin.resume();",
      ],
      {
        quiet: true,
        stdinMode: "ignore",
        timeoutMs: 1_000,
      },
    );

    expect(result.stdout).toBe("stdin-closed");
  });

  it("kills timed out commands and throws a timeout-specific error", async () => {
    await expect(
      runCommand(
        "node",
        ["-e", "setInterval(() => {}, 1_000);"],
        {
          quiet: true,
          timeoutMs: 50,
        },
      ),
    ).rejects.toThrow(/Command timed out after 50ms/u);
  });
});
