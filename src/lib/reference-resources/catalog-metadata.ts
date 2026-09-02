import {
  ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
  JP_PEOPLE_ID3_RESOURCE_KEY,
  PEID_RESOURCE_KEY,
  SOURCE_ALIASES_RESOURCE_KEY,
  TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
} from "./pipeline-types";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
  SEMANTIC_CONTEXT_RESOURCE_KEY,
  type ReferenceResourceKey,
} from "./types";

export const REFERENCE_RESOURCE_AFFECTED_ENGINES: Readonly<
  Record<ReferenceResourceKey, readonly string[]>
> = {
  [COUNTRY_RESOURCE_KEY]: [
    "AX source forming",
    "Etnopedia source forming",
    "IMB source forming",
    "Joshua Project source forming",
    "WCD source forming",
    "Tier 2 partner forming",
  ],
  [ROP_RESOURCE_KEY]: [
    "Etnopedia source forming",
    "IMB source forming",
    "Tier 2 partner forming",
  ],
  [SOURCE_ALIASES_RESOURCE_KEY]: [
    "Tier 1 source forming",
    "Tier 1 merge products",
  ],
  [JP_PEOPLE_ID3_RESOURCE_KEY]: ["Tier 2 partner forming"],
  [PEID_RESOURCE_KEY]: ["Tier 2 partner forming"],
  [TIER1_MERGE_PRIORITIES_RESOURCE_KEY]: [
    "Tier 1 merge products",
    "Aggregate 1 products",
  ],
  [ENGAGEMENT_MAPPINGS_RESOURCE_KEY]: ["Tier 2 partner forming"],
  [SEMANTIC_CONTEXT_RESOURCE_KEY]: ["Private Qwen data chat"],
};

export function affectedEnginesForResource(resourceKey: ReferenceResourceKey) {
  return [...REFERENCE_RESOURCE_AFFECTED_ENGINES[resourceKey]];
}
