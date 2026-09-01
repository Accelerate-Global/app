import { performance } from "node:perf_hooks";

import type { PrivateDataChatSemanticContextPackage } from "@/lib/private-data-chat/semantic-context";
import {
  PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS,
  PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS_VERSION,
  type SemanticEvaluationCase,
} from "@/lib/private-data-chat/semantic-evaluation-corpus";
import { retrievePrivateDataChatSemanticContext } from "@/lib/private-data-chat/retrieval";

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function ndcgAt6(keys: readonly string[], relevant: ReadonlySet<string>) {
  const dcg = keys.slice(0, 6).reduce(
    (total, key, index) =>
      total + (relevant.has(key) ? 1 / Math.log2(index + 2) : 0),
    0,
  );
  const ideal = Array.from(
    { length: Math.min(6, relevant.size) },
    (_unused, index) => 1 / Math.log2(index + 2),
  ).reduce((total, gain) => total + gain, 0);
  return ideal > 0 ? dcg / ideal : 1;
}

function reciprocalRank(keys: readonly string[], relevant: ReadonlySet<string>) {
  const index = keys.findIndex((key) => relevant.has(key));
  return index === -1 ? 0 : 1 / (index + 1);
}

export type PrivateDataChatRetrievalBenchmarkCase = Readonly<{
  id: string;
  partition: SemanticEvaluationCase["partition"];
  critical: boolean;
  required: readonly string[];
  relevant: readonly string[];
  forbidden: readonly string[];
  selected: readonly string[];
  status: "ready" | "clarify" | "unavailable";
  recallAt1: number;
  recallAt6: number;
  ndcgAt6: number;
  reciprocalRank: number;
  requiredSetCovered: boolean;
  forbiddenSelected: readonly string[];
  bytes: number;
  latencyMs: number;
  repeatable: boolean;
}>;

export async function runPrivateDataChatRetrievalBenchmark(input: {
  package: PrivateDataChatSemanticContextPackage;
  cases?: readonly SemanticEvaluationCase[];
  repetitions?: number;
}) {
  const repetitions = input.repetitions ?? 3;
  const cases = input.cases ?? PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS;
  const results: PrivateDataChatRetrievalBenchmarkCase[] = [];

  for (const testCase of cases) {
    const runs: Array<{
      keys: string[];
      status: "ready" | "clarify" | "unavailable";
      bytes: number;
      latencyMs: number;
    }> = [];
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const started = performance.now();
      const result = await retrievePrivateDataChatSemanticContext({
        utterance: testCase.question,
        audience: "planner",
        package: input.package,
      });
      runs.push({
        keys:
          result.status === "ready"
            ? result.items.map((item) => item.stableKey)
            : [],
        status: result.status,
        bytes: result.status === "ready" ? result.bytes : 0,
        latencyMs: performance.now() - started,
      });
    }
    const run = runs[0]!;
    const required = new Set(testCase.humanRelevance.requiredCardKeys);
    const relevant = new Set([
      ...testCase.humanRelevance.requiredCardKeys,
      ...testCase.humanRelevance.relevantCardKeys,
    ]);
    const forbidden = new Set(testCase.humanRelevance.forbiddenCardKeys);
    const recallAt1 =
      relevant.size === 0
        ? run.status !== "ready"
          ? 1
          : 0
        : run.keys[0] && relevant.has(run.keys[0])
          ? 1
          : 0;
    const recallAt6 =
      relevant.size === 0
        ? recallAt1
        : [...relevant].filter((key) => run.keys.slice(0, 6).includes(key)).length /
          relevant.size;
    results.push({
      id: testCase.id,
      partition: testCase.partition,
      critical: testCase.critical,
      required: [...required],
      relevant: [...relevant],
      forbidden: [...forbidden],
      selected: run.keys,
      status: run.status,
      recallAt1,
      recallAt6,
      ndcgAt6: ndcgAt6(run.keys, relevant),
      reciprocalRank: reciprocalRank(run.keys, relevant),
      requiredSetCovered: [...required].every((key) => run.keys.includes(key)),
      forbiddenSelected: run.keys.filter((key) => forbidden.has(key)),
      bytes: run.bytes,
      latencyMs: Math.max(...runs.map((candidate) => candidate.latencyMs)),
      repeatable:
        new Set(
          runs.map((candidate) =>
            JSON.stringify([candidate.status, candidate.keys]),
          ),
        ).size === 1,
    });
  }

  const critical = results.filter((result) => result.critical);
  const holdout = results.filter(
    (result) => result.partition === "holdout" && result.relevant.length > 0,
  );
  const exactCritical = results.filter(
    (result) =>
      result.critical &&
      /(?:exact|uupg-definition|rop-name-ambiguity)/u.test(result.id),
  );
  const p95Index = Math.max(
    0,
    Math.ceil(results.length * 0.95) - 1,
  );
  const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
  const metrics = {
    caseCount: results.length,
    exactCriticalRecallAt1: round(
      exactCritical.reduce((total, result) => total + result.recallAt1, 0) /
        Math.max(1, exactCritical.length),
    ),
    criticalRequiredSetCoverage: round(
      critical.filter((result) => result.requiredSetCovered).length /
        Math.max(1, critical.length),
    ),
    holdoutRecallAt6: round(
      holdout.reduce((total, result) => total + result.recallAt6, 0) /
        Math.max(1, holdout.length),
    ),
    holdoutNdcgAt6: round(
      holdout.reduce((total, result) => total + result.ndcgAt6, 0) /
        Math.max(1, holdout.length),
    ),
    mrr: round(
      results.reduce((total, result) => total + result.reciprocalRank, 0) /
        Math.max(1, results.length),
    ),
    forbiddenSelectionCount: results.reduce(
      (total, result) => total + result.forbiddenSelected.length,
      0,
    ),
    clarificationAccuracy: round(
      results.filter(
        (result) =>
          cases.find((testCase) => testCase.id === result.id)?.expected
            .reasonCode === "off_topic" && result.status !== "ready",
      ).length /
        Math.max(
          1,
          results.filter(
            (result) =>
              cases.find((testCase) => testCase.id === result.id)?.expected
                .reasonCode === "off_topic",
          ).length,
        ),
    ),
    maximumContextBytes: Math.max(...results.map((result) => result.bytes), 0),
    lexicalP95Ms: round(latencies[p95Index] ?? 0),
    repeatable: results.every((result) => result.repeatable),
  };
  const gates = {
    exactCriticalRecallAt1: metrics.exactCriticalRecallAt1 === 1,
    criticalRequiredSetCoverage: metrics.criticalRequiredSetCoverage === 1,
    holdoutRecallAt6: metrics.holdoutRecallAt6 >= 0.95,
    noForbiddenSelection: metrics.forbiddenSelectionCount === 0,
    clarificationAccuracy: metrics.clarificationAccuracy === 1,
    contextBudget: metrics.maximumContextBytes <= 8 * 1024,
    lexicalLatency: metrics.lexicalP95Ms < 25,
    repeatable: metrics.repeatable,
  };
  return {
    version: PRIVATE_DATA_CHAT_SEMANTIC_EVALUATION_CORPUS_VERSION,
    tier: "exact-postgres-lexical" as const,
    repetitions,
    metrics,
    gates,
    passed: Object.values(gates).every(Boolean),
    cases: results,
  };
}
