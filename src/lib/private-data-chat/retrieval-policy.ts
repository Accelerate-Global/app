import { createHash } from "node:crypto";

export const PRIVATE_DATA_CHAT_RETRIEVAL_MAX_ITEMS = 6;
export const PRIVATE_DATA_CHAT_RETRIEVAL_MAX_DEMONSTRATIONS = 2;
export const PRIVATE_DATA_CHAT_RETRIEVAL_MAX_BYTES = 8 * 1024;
export const PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION =
  "semantic-retrieval-v1.1.exact-fts-coverage" as const;

export const PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_CHECKSUM = createHash("sha256")
  .update(
    JSON.stringify({
      version: PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION,
      exactAliasPrecedence: true,
      domainAnchorVocabulary: "catalog-v2-includes-people-identifiers",
      lexical: "postgres-english-plainto-tsquery-ts-rank-cd",
      dependencyExpansion: "typed-recursive",
      stableTieBreak: "stableKey-asc",
      maximumItems: PRIVATE_DATA_CHAT_RETRIEVAL_MAX_ITEMS,
      maximumDemonstrations: PRIVATE_DATA_CHAT_RETRIEVAL_MAX_DEMONSTRATIONS,
      maximumBytes: PRIVATE_DATA_CHAT_RETRIEVAL_MAX_BYTES,
      approximateIndexes: false,
    }),
  )
  .digest("hex");
