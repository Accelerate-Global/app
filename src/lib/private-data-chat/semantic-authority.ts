import { createHash } from "node:crypto";

import { ROP_RESOURCE_KEY } from "@/lib/reference-resources/types";

export const PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY = Object.freeze({
  version: 1,
  resources: Object.freeze({
    [ROP_RESOURCE_KEY]: Object.freeze({
      resourceKey: ROP_RESOURCE_KEY,
      access: "authenticated-read-only",
      operations: Object.freeze(["search", "list", "lookup", "count", "continue"]),
      maxPageSize: 25,
      stableOrdering: "stable_key_ascending",
      completeExport: "authenticated-streamed-csv",
      lifecycleMutations: false,
    }),
  }),
});

export const PRIVATE_DATA_CHAT_RELATIONSHIP_REGISTRY = Object.freeze({
  version: 1,
  relationships: Object.freeze({
    people_group_to_bound_rop3: Object.freeze({
      key: "people_group_to_bound_rop3",
      sourceDataset: "primary_people_groups",
      sourceGrain: "people_group",
      targetResource: ROP_RESOURCE_KEY,
      targetGrain: "rop3_classification",
      cardinality: "many-to-one",
      joinBehavior: "left-null-preserving",
      versionPolicy: "dataset-production-lineage",
      modelMaySelectPhysicalKeys: false,
      geographyBehavior: "exists-or-dedicated-grain",
    }),
  }),
});

export const PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS = Object.freeze([
  "rop1_code",
  "rop1_name",
  "rop2_code",
  "rop2_name",
  "rop25_code",
  "rop25_name",
  "rop3_code",
  "rop3_name",
  "rop3_status",
  "rop_place",
  "rop_language",
  "rop_source",
  "rop_join_issue",
  "rop_match_status",
] as const);

export const PRIVATE_DATA_CHAT_ROP_FIELD_DEFINITIONS = Object.freeze({
  rop1_code: { label: "ROP1 code", definition: "Canonical ROP1 code for the bound ROP3 classification.", aliases: ["affinity bloc code"] },
  rop1_name: { label: "ROP1 name", definition: "Canonical ROP1 name for the bound ROP3 classification.", aliases: ["affinity bloc"] },
  rop2_code: { label: "ROP2 code", definition: "Canonical ROP2 code for the bound ROP3 classification.", aliases: ["people cluster code"] },
  rop2_name: { label: "ROP2 name", definition: "Canonical ROP2 name for the bound ROP3 classification.", aliases: ["people cluster"] },
  rop25_code: { label: "ROP2.5 code", definition: "Canonical ROP2.5 code for the bound ROP3 classification.", aliases: ["rop25", "people code"] },
  rop25_name: { label: "ROP2.5 name", definition: "Canonical ROP2.5 name for the bound ROP3 classification.", aliases: ["rop25 name", "people classification"] },
  rop3_code: { label: "ROP3 code", definition: "Normalized six-digit ROP3 code stored on the people-group record.", aliases: ["registry of peoples code"] },
  rop3_name: { label: "ROP3 name", definition: "Canonical ROP3 name from the dataset-bound ROP version.", aliases: ["registry of peoples name"] },
  rop3_status: { label: "ROP3 status", definition: "Active or inactive status of the dataset-bound ROP3 entry.", aliases: ["rop status"] },
  rop_place: { label: "ROP place", definition: "Reviewed ROP place text for the bound classification.", aliases: ["rop location"] },
  rop_language: { label: "ROP language", definition: "Reviewed ROP language text for the bound classification.", aliases: ["registry language"] },
  rop_source: { label: "ROP source", definition: "Reviewed source label from the bound ROP entry.", aliases: ["registry source"] },
  rop_join_issue: { label: "ROP join issue", definition: "Structured hierarchy warning recorded by the bound ROP resource.", aliases: ["rop hierarchy issue"] },
  rop_match_status: { label: "ROP match status", definition: "Typed match state: matched, blank, malformed, inactive, unmatched, join_issue, or unbound.", aliases: ["rop binding status"] },
} as const);

export const PRIVATE_DATA_CHAT_ROP_GEOGRAPHY_FILTER = Object.freeze({
  key: "rop_geography" as const,
  label: "ROP geography",
  definition:
    "A reviewed ROP geography name or code matched with an EXISTS-style predicate that preserves one row per people group.",
  aliases: ["ROP geography", "ROP country", "registry geography"],
});

const AUTHORITY_CONTENT = Object.freeze({
  resourceOperations: PRIVATE_DATA_CHAT_RESOURCE_OPERATION_REGISTRY,
  relationships: PRIVATE_DATA_CHAT_RELATIONSHIP_REGISTRY,
  ropFields: PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS,
  ropFieldDefinitions: PRIVATE_DATA_CHAT_ROP_FIELD_DEFINITIONS,
  ropGeographyFilter: PRIVATE_DATA_CHAT_ROP_GEOGRAPHY_FILTER,
});

export const PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_CHECKSUM = createHash("sha256")
  .update(JSON.stringify(AUTHORITY_CONTENT))
  .digest("hex");

export const PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_VERSION =
  `semantic-authority-v1.${PRIVATE_DATA_CHAT_SEMANTIC_AUTHORITY_CHECKSUM.slice(0, 12)}`;
