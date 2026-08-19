import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("API connection alert capture ordering", () => {
  it("captures the standard run only after failed state and failure log persistence", async () => {
    const source = await readFile("src/lib/api-connections/index.ts", "utf8");
    const executeStart = source.indexOf("export async function executeApiConnectionRun");
    const catchStart = source.indexOf("  } catch (error) {", executeStart);
    const catchEnd = source.indexOf("\n    return {", catchStart);
    const failureBlock = source.slice(catchStart, catchEnd);

    expect(executeStart).toBeGreaterThan(-1);
    expect(catchStart).toBeGreaterThan(executeStart);
    expect(failureBlock.indexOf("await updateRun({")).toBeGreaterThan(-1);
    expect(failureBlock.indexOf("await insertRunLog({")).toBeGreaterThan(
      failureBlock.indexOf("await updateRun({"),
    );
    expect(
      failureBlock.indexOf("await captureFailedApiConnectionRun({"),
    ).toBeGreaterThan(failureBlock.indexOf("await insertRunLog({"));
  });
});
