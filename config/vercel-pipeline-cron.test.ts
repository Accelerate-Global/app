import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Vercel pipeline coordinator schedule", () => {
  it("runs the protected durable coordinator once per day", async () => {
    const config = JSON.parse(
      await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    ) as { crons?: Array<{ path: string; schedule: string }> };

    expect(config.crons).toContainEqual({
      path: "/api/internal/pipeline-operations/run",
      schedule: "0 17 * * *",
    });
  });
});
