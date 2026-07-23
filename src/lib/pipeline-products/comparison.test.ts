import { describe, expect, it } from "vitest";

import { comparePipelineOutput } from "./comparison";

describe("pipeline side-by-side comparison", () => {
  it("explains added, removed, and changed rows without source payloads", () => {
    const report = comparePipelineOutput({
      definitionKey: "tier1-pgic-merge",
      currentRows: [{ PGIC: "one", value: "current" }, { PGIC: "added", value: "new" }],
      retainedRows: [{ PGIC: "one", value: "retained" }, { PGIC: "removed", value: "old" }],
    });
    expect(report.onlyCurrentKeys).toEqual(["added"]);
    expect(report.onlyRetainedKeys).toEqual(["removed"]);
    expect(report.changedKeys).toEqual(["one"]);
    expect(JSON.stringify(report)).not.toContain("current\"");
  });
});
