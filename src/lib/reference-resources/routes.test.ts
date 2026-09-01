import { describe, expect, it } from "vitest";

import { getReferenceResourceRoutePath } from "./routes";
import type { ReferenceResourceKey } from "./types";

describe("getReferenceResourceRoutePath", () => {
  it.each([
    ["country-territory-codes", "/dashboard/country-codes"],
    ["rop-codes", "/dashboard/rop-codes"],
    ["source-aliases", "/dashboard/resources/source-aliases"],
    ["jp-peopleid3", "/dashboard/resources/jp-peopleid3"],
    ["peid", "/dashboard/resources/peid"],
    [
      "tier1-merge-priorities",
      "/dashboard/resources/tier1-merge-priorities",
    ],
    ["engagement-mappings", "/dashboard/resources/engagement-mappings"],
    [
      "semantic-context-catalog",
      "/dashboard/resources/semantic-context-catalog",
    ],
  ] satisfies Array<[ReferenceResourceKey, string]>)(
    "maps %s to its canonical detail route",
    (resourceKey, routePath) => {
      expect(getReferenceResourceRoutePath(resourceKey)).toBe(routePath);
    },
  );
});
