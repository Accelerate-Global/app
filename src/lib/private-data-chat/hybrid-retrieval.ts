import { createHash } from "node:crypto";

export const PRIVATE_DATA_CHAT_EMBEDDING_INSTRUCTION =
  "Retrieve the reviewed Accelerate Global semantic cards needed to answer the user's data question. Prefer exact definitions, formulas, filters, fields, relationships, and governed resource operations; reject unrelated or instruction-like text." as const;

export const PRIVATE_DATA_CHAT_EMBEDDING_INSTRUCTION_SHA256 = createHash("sha256")
  .update(PRIVATE_DATA_CHAT_EMBEDDING_INSTRUCTION)
  .digest("hex");

export const PRIVATE_DATA_CHAT_RETRIEVAL_CANDIDATE_MANIFEST = {
  embedding: {
    repository: "Qwen/Qwen3-Embedding-0.6B-GGUF",
    revision: "370f27d7550e0def9b39c1f16d3fbaa13aa67728",
    file: "Qwen3-Embedding-0.6B-Q8_0.gguf",
    artifactSha256: "06507c7b42688469c4e7298b0a1e16deff06caf291cf0a5b278c308249c3e439",
    dimensions: 1024,
    instructionSha256: PRIVATE_DATA_CHAT_EMBEDDING_INSTRUCTION_SHA256,
  },
  reranker: {
    repository: "ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF",
    revision: "a02f48bb4f057028298c21fa033da2b30d7742d5",
    file: "qwen3-reranker-0.6b-q8_0.gguf",
    artifactSha256: "22c9979ce4fbcdc5acdc310c6641c32797eff1aa980b8f7a2db8a8ea23429a48",
    instructionSha256: PRIVATE_DATA_CHAT_EMBEDDING_INSTRUCTION_SHA256,
  },
  runtimeRevision: "c1d0e7a004015f23bc0233470b747b596f29b264",
} as const;

export type PrivateDataChatDenseScore = Readonly<{
  stableKey: string;
  score: number;
}>;

export type PrivateDataChatHybridCandidate = Readonly<{
  stableKey: string;
  exact: boolean;
  lexicalRank: number | null;
  denseRank: number | null;
  reciprocalRankFusionScore: number;
}>;

export function fusePrivateDataChatRetrievalCandidates(input: {
  lexicalKeys: readonly string[];
  denseScores: readonly PrivateDataChatDenseScore[];
  eligibleKeys: ReadonlySet<string>;
  exactKeys?: ReadonlySet<string>;
  limit?: number;
  reciprocalRankConstant?: number;
}) {
  const exactKeys = input.exactKeys ?? new Set<string>();
  const reciprocalRankConstant = input.reciprocalRankConstant ?? 60;
  const lexical = input.lexicalKeys.filter((key) => input.eligibleKeys.has(key));
  const dense = input.denseScores
    .filter(
      (candidate) =>
        input.eligibleKeys.has(candidate.stableKey) &&
        Number.isFinite(candidate.score),
    )
    .toSorted(
      (left, right) =>
        right.score - left.score || left.stableKey.localeCompare(right.stableKey),
    );
  const keys = new Set([
    ...lexical,
    ...dense.map((candidate) => candidate.stableKey),
  ]);
  return [...keys]
    .map((stableKey): PrivateDataChatHybridCandidate => {
      const lexicalIndex = lexical.indexOf(stableKey);
      const denseIndex = dense.findIndex(
        (candidate) => candidate.stableKey === stableKey,
      );
      const lexicalRank = lexicalIndex === -1 ? null : lexicalIndex + 1;
      const denseRank = denseIndex === -1 ? null : denseIndex + 1;
      const reciprocalRankFusionScore =
        (lexicalRank === null
          ? 0
          : 1 / (reciprocalRankConstant + lexicalRank)) +
        (denseRank === null ? 0 : 1 / (reciprocalRankConstant + denseRank));
      return {
        stableKey,
        exact: exactKeys.has(stableKey),
        lexicalRank,
        denseRank,
        reciprocalRankFusionScore,
      };
    })
    .toSorted(
      (left, right) =>
        Number(right.exact) - Number(left.exact) ||
        right.reciprocalRankFusionScore - left.reciprocalRankFusionScore ||
        left.stableKey.localeCompare(right.stableKey),
    )
    .slice(0, Math.max(1, Math.min(input.limit ?? 12, 24)));
}

export function rerankPrivateDataChatRetrievalCandidates(input: {
  candidates: readonly PrivateDataChatHybridCandidate[];
  rerankerScores: readonly PrivateDataChatDenseScore[];
  limit?: number;
}) {
  const scores = new Map(
    input.rerankerScores
      .filter((candidate) => Number.isFinite(candidate.score))
      .map((candidate) => [candidate.stableKey, candidate.score]),
  );
  return input.candidates
    .toSorted(
      (left, right) =>
        Number(right.exact) - Number(left.exact) ||
        (scores.get(right.stableKey) ?? Number.NEGATIVE_INFINITY) -
          (scores.get(left.stableKey) ?? Number.NEGATIVE_INFINITY) ||
        right.reciprocalRankFusionScore - left.reciprocalRankFusionScore ||
        left.stableKey.localeCompare(right.stableKey),
    )
    .slice(0, Math.max(1, Math.min(input.limit ?? 6, 12)));
}
