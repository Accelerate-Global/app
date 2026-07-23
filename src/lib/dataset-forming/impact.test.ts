import { describe, expect, it } from "vitest";

import { listDatasetFormingEnginesUsingResource } from "./impact";

describe("dataset forming resource impact", () => {
  it("reports every registered engine that binds Country resources", () => {
    expect(
      listDatasetFormingEnginesUsingResource("country-territory-codes")
        .map((engine) => engine.engineKey)
        .sort(),
    ).toEqual([
      "accelerate",
      "etnopedia",
      "imb",
      "joshua-project",
      "wcd",
    ]);
  });

  it("reports no impact for an undeclared resource", () => {
    expect(listDatasetFormingEnginesUsingResource("unknown-resource")).toEqual(
      [],
    );
  });
});
