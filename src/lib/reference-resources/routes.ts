import type { ReferenceResourceKey } from "./types";

const REFERENCE_RESOURCE_ROUTES = {
  "country-territory-codes": "/dashboard/country-codes",
  "rop-codes": "/dashboard/rop-codes",
  "source-aliases": "/dashboard/resources/source-aliases",
  "jp-peopleid3": "/dashboard/resources/jp-peopleid3",
  peid: "/dashboard/resources/peid",
  "tier1-merge-priorities":
    "/dashboard/resources/tier1-merge-priorities",
  "engagement-mappings":
    "/dashboard/resources/engagement-mappings",
  "semantic-context-catalog":
    "/dashboard/resources/semantic-context-catalog",
} as const satisfies Record<ReferenceResourceKey, string>;

export function getReferenceResourceRoutePath(
  resourceKey: ReferenceResourceKey,
) {
  return REFERENCE_RESOURCE_ROUTES[resourceKey];
}
