import { describe, expect, it } from "vitest";

import {
  canonicalizeDatasetFormingValue,
  checksumDatasetFormingValue,
} from "./canonical";

describe("dataset forming canonical values", () => {
  it("sorts object keys recursively while retaining array order", () => {
    const first = { z: 1, a: { d: 4, b: 2 }, rows: [{ y: 2, x: 1 }] };
    const second = { rows: [{ x: 1, y: 2 }], a: { b: 2, d: 4 }, z: 1 };

    expect(canonicalizeDatasetFormingValue(first)).toBe(
      canonicalizeDatasetFormingValue(second),
    );
    expect(checksumDatasetFormingValue(first)).toBe(
      checksumDatasetFormingValue(second),
    );
  });
});
