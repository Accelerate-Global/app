import { describe, expect, it } from "vitest";

import { createAxIdentityArtifactPath } from "./storage";

describe("AX identity artifact storage", () => {
  it("uses immutable run-scoped paths", () => {
    expect(createAxIdentityArtifactPath("run-1", "rows")).toBe(
      "identity-registry-runs/run-1/rows.json",
    );
    expect(createAxIdentityArtifactPath("run-1", "csv")).toBe(
      "identity-registry-runs/run-1/csv.csv",
    );
  });
});
