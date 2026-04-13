import { describe, expect, it } from "vitest";

import { assertDatasetOwner, isDatasetOwner } from "@/lib/authz";

describe("dataset ownership helpers", () => {
  it("accepts matching owners", () => {
    expect(isDatasetOwner({ ownerId: "user_1" }, "user_1")).toBe(true);
  });

  it("rejects missing or mismatched owners", () => {
    expect(isDatasetOwner(null, "user_1")).toBe(false);
    expect(isDatasetOwner({ ownerId: "user_2" }, "user_1")).toBe(false);
  });

  it("throws a not-found style error for mismatched owners", () => {
    expect(() => assertDatasetOwner({ ownerId: "user_2" }, "user_1")).toThrow(
      "Dataset not found.",
    );
  });
});
