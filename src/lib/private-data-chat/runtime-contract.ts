import { createHash } from "node:crypto";

import {
  PRIVATE_DATA_CHAT_CATALOG,
  PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
} from "@/lib/private-data-chat/catalog";
import { PRIVATE_DATA_CHAT_POLICY_VERSION } from "@/lib/private-data-chat/compiler";
import {
  PRIVATE_DATA_CHAT_NAMED_FILTER_CHECKSUM,
  PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
} from "@/lib/private-data-chat/named-filters";
import {
  PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_CHECKSUM,
  PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION,
} from "@/lib/private-data-chat/retrieval-policy";
import {
  PRIVATE_DATA_CHAT_ANSWER_JSON_SCHEMA,
  PRIVATE_DATA_CHAT_PLAN_JSON_SCHEMA,
  PRIVATE_DATA_CHAT_RESOURCE_OPERATIONS,
} from "@/lib/private-data-chat/schemas";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function hashPrivateDataChatRuntimeContractValue(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
}

export const PRIVATE_DATA_CHAT_PLANNER_SCHEMA_CHECKSUM =
  hashPrivateDataChatRuntimeContractValue(PRIVATE_DATA_CHAT_PLAN_JSON_SCHEMA);

export const PRIVATE_DATA_CHAT_ANSWER_SCHEMA_CHECKSUM =
  hashPrivateDataChatRuntimeContractValue(PRIVATE_DATA_CHAT_ANSWER_JSON_SCHEMA);

export const PRIVATE_DATA_CHAT_RUNTIME_CONTRACT = Object.freeze({
  version: "private-data-chat-runtime-contract-v1" as const,
  catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
  catalogChecksum: PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
  compilerPolicyVersion: PRIVATE_DATA_CHAT_POLICY_VERSION,
  namedFilterRegistryVersion: PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
  namedFilterRegistryChecksum: PRIVATE_DATA_CHAT_NAMED_FILTER_CHECKSUM,
  retrievalPolicyVersion: PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION,
  retrievalPolicyChecksum: PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_CHECKSUM,
  plannerSchemaChecksum: PRIVATE_DATA_CHAT_PLANNER_SCHEMA_CHECKSUM,
  answerSchemaChecksum: PRIVATE_DATA_CHAT_ANSWER_SCHEMA_CHECKSUM,
  resourceOperations: [...PRIVATE_DATA_CHAT_RESOURCE_OPERATIONS],
  relationshipKeys: [...PRIVATE_DATA_CHAT_CATALOG.joinCapabilities],
});

export const PRIVATE_DATA_CHAT_RUNTIME_CONTRACT_CHECKSUM =
  hashPrivateDataChatRuntimeContractValue(PRIVATE_DATA_CHAT_RUNTIME_CONTRACT);
