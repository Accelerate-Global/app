import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it, vi } from "vitest";

const execFileAsync = promisify(execFile);

describe("seed-field-sources", () => {
  it("closes the shared database handle when seeding fails", async () => {
    const closeDbMock = vi.fn().mockResolvedValue(undefined);
    const seedFieldSourceRegistryIfNeededMock = vi
      .fn()
      .mockRejectedValue(new Error("seed failed"));
    const { runSeedFieldSources } = await import("./seed-field-sources");

    process.env.DATABASE_URL = "postgresql://example.com/postgres";

    await expect(
      runSeedFieldSources({
        closeDb: closeDbMock,
        seedFieldSourceRegistryIfNeeded: seedFieldSourceRegistryIfNeededMock,
      }),
    ).rejects.toThrow("seed failed");

    expect(closeDbMock).toHaveBeenCalledTimes(1);
  });

  it("prints the success line and exits promptly after cleanup closes open handles", async () => {
    const fixturePath = path.join(
      process.cwd(),
      "scripts",
      "fixtures",
      "seed-field-sources-process-fixture.ts",
    );
    const startedAt = Date.now();
    const { stderr, stdout } = await execFileAsync(
      "node",
      ["--import", "tsx", fixturePath],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: "postgresql://example.com/postgres",
        },
        timeout: 1_000,
      },
    );

    expect(stdout.trim()).toBe(
      "Field source registry seed pass completed from the mapping and description CSV files.",
    );
    expect(stderr).toBe("");
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });
});
