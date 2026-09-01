import { writeFile } from "node:fs/promises";

import {
  PRIVATE_DATA_CHAT_EMBEDDING_INSTRUCTION,
  PRIVATE_DATA_CHAT_RETRIEVAL_CANDIDATE_MANIFEST,
} from "@/lib/private-data-chat/hybrid-retrieval";
import { retrievePrivateDataChatSemanticContext } from "@/lib/private-data-chat/retrieval";
import { PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS } from "@/lib/private-data-chat/semantic-evaluation-corpus";
import { buildPrivateDataChatSemanticContextPackage } from "@/lib/private-data-chat/semantic-context";

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function exactKeys(
  question: string,
  cards: readonly Readonly<{
    stableKey: string;
    label: string;
    aliases: readonly string[];
  }>[],
) {
  const normalizedQuestion = ` ${normalize(question)} `;
  return cards
    .filter((card) =>
      [card.stableKey, card.label, ...card.aliases]
        .map(normalize)
        .filter((phrase) => phrase.length >= 3)
        .some(
          (phrase) =>
            normalizedQuestion === ` ${phrase} ` ||
            normalizedQuestion.includes(` ${phrase} `),
        ),
    )
    .map((card) => card.stableKey)
    .sort();
}

export async function buildPrivateDataChatRetrievalBakeoffBundle() {
  const semanticPackage = buildPrivateDataChatSemanticContextPackage({
    sourceRetrievedAt: "2026-08-31T00:00:00.000Z",
  }).package;
  const cards = semanticPackage.entries.map((card) => ({
    stableKey: card.stableKey,
    contentChecksum: card.contentChecksum,
    audiences: card.audiences,
    sensitivity: card.sensitivity,
    queryAuthority: card.queryAuthority,
    dependencies: card.dependencies,
    label: card.label,
    aliases: card.aliases,
    text: card.contextualSearchText,
    contextItem: {
      stableKey: card.stableKey,
      kind: card.kind,
      label: card.label,
      definition: card.definition,
      aliases: card.aliases,
      grain: card.grain,
      valueType: card.valueType,
      unit: card.unit,
      nullMeaning: card.nullMeaning,
      allowedValuePolicy: card.allowedValuePolicy,
      formula: card.formula,
      dependencies: card.dependencies,
      relationships: card.relationships,
      resourceOperations: card.resourceOperations,
      examples: card.examples,
      counterexamples: card.counterexamples,
      queryAuthority: card.queryAuthority,
      contentChecksum: card.contentChecksum,
    },
  }));
  const cases = await Promise.all(
    PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS.map(async (testCase) => {
      const audience = testCase.stage === "answer" ? "answer" : "planner";
      const lexical = await retrievePrivateDataChatSemanticContext({
        utterance: testCase.question,
        audience,
        package: semanticPackage,
      });
      return {
        id: testCase.id,
        partition: testCase.partition,
        critical: testCase.critical,
        audience,
        question: testCase.question,
        required: testCase.humanRelevance.requiredCardKeys,
        relevant: [
          ...new Set([
            ...testCase.humanRelevance.requiredCardKeys,
            ...testCase.humanRelevance.relevantCardKeys,
          ]),
        ],
        forbidden: testCase.humanRelevance.forbiddenCardKeys,
        expectedReasonCode: testCase.expected.reasonCode ?? null,
        exactKeys: exactKeys(testCase.question, cards),
        lexical:
          lexical.status === "ready"
            ? lexical.items.map((item) => item.stableKey)
            : [],
        lexicalStatus: lexical.status,
      };
    }),
  );
  return {
    schemaVersion: 1,
    semanticSnapshotChecksum: semanticPackage.definitionPackageChecksum,
    semanticCardCount: cards.length,
    embeddingInstruction: PRIVATE_DATA_CHAT_EMBEDDING_INSTRUCTION,
    candidateManifest: PRIVATE_DATA_CHAT_RETRIEVAL_CANDIDATE_MANIFEST,
    cards,
    cases,
  };
}

async function main() {
  const output = process.argv[2];
  if (!output) {
    throw new Error(
      "Usage: private-data-chat-retrieval-bakeoff-export.ts OUTPUT.json",
    );
  }
  const bundle = await buildPrivateDataChatRetrievalBakeoffBundle();
  await writeFile(output, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      output,
      semanticSnapshotChecksum: bundle.semanticSnapshotChecksum,
      cardCount: bundle.cards.length,
      caseCount: bundle.cases.length,
    }),
  );
}

if (process.argv[1]?.endsWith("private-data-chat-retrieval-bakeoff-export.ts")) {
  void main();
}
