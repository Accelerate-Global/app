import { createHash } from "node:crypto";

export const PRIVATE_DATA_CHAT_RETRIEVAL_MAX_ITEMS = 6;
export const PRIVATE_DATA_CHAT_RETRIEVAL_MAX_DEMONSTRATIONS = 2;
export const PRIVATE_DATA_CHAT_RETRIEVAL_MAX_BYTES = 8 * 1024;
export const PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION =
  "semantic-retrieval-v1.1.reviewed-exact-anchor-fts-coverage" as const;

export const PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_CHECKSUM = createHash("sha256")
  .update(
    JSON.stringify({
      version: PRIVATE_DATA_CHAT_RETRIEVAL_POLICY_VERSION,
      exactAliasPrecedence: true,
      domainAnchorVocabulary: "reviewed-card-exact-labels-and-aliases",
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
