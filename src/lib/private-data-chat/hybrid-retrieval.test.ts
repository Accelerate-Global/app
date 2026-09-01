import { describe, expect, it } from "vitest";

import {
  PRIVATE_DATA_CHAT_EMBEDDING_INSTRUCTION_SHA256,
  fusePrivateDataChatRetrievalCandidates,
  rerankPrivateDataChatRetrievalCandidates,
} from "@/lib/private-data-chat/hybrid-retrieval";

describe("private data chat optional hybrid retrieval", () => {
  it("filters policy-ineligible cards before fusion and preserves exact precedence", () => {
    const candidates = fusePrivateDataChatRetrievalCandidates({
      lexicalKeys: ["exact", "lexical", "forbidden"],
      denseScores: [
        { stableKey: "dense", score: 0.99 },
        { stableKey: "forbidden", score: 1 },
        { stableKey: "exact", score: 0.1 },
      ],
      eligibleKeys: new Set(["exact", "lexical", "dense"]),
      exactKeys: new Set(["exact"]),
    });
    expect(candidates.map((candidate) => candidate.stableKey)).toEqual([
      "exact",
      "dense",
      "lexical",
    ]);
    expect(JSON.stringify(candidates)).not.toContain("forbidden");
  });

  it("reranks only bounded fused candidates without dislodging exact matches", () => {
    const fused = fusePrivateDataChatRetrievalCandidates({
      lexicalKeys: ["exact", "second", "third"],
      denseScores: [
        { stableKey: "third", score: 0.9 },
        { stableKey: "second", score: 0.8 },
      ],
      eligibleKeys: new Set(["exact", "second", "third"]),
      exactKeys: new Set(["exact"]),
    });
    const reranked = rerankPrivateDataChatRetrievalCandidates({
      candidates: fused,
      rerankerScores: [
        { stableKey: "third", score: 0.99 },
        { stableKey: "exact", score: 0 },
        { stableKey: "second", score: 0.5 },
      ],
    });
    expect(reranked.map((candidate) => candidate.stableKey)).toEqual([
      "exact",
      "third",
      "second",
    ]);
  });

  it("pins the domain instruction with a SHA-256 manifest value", () => {
    expect(PRIVATE_DATA_CHAT_EMBEDDING_INSTRUCTION_SHA256).toMatch(
      /^[0-9a-f]{64}$/u,
    );
  });
});
