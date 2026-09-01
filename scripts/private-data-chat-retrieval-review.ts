import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { runPrivateDataChatRetrievalBenchmark } from "@/lib/private-data-chat/retrieval-benchmark";
import { runPrivateDataChatRopEntryBenchmark } from "@/lib/private-data-chat/rop-entry-benchmark";
import { buildPrivateDataChatSemanticContextPackage } from "@/lib/private-data-chat/semantic-context";
import { getGeneratedRopCodeResource } from "@/lib/rop-codes";

const OUTPUT = "docs/operations/private-data-chat-retrieval-benchmark-v1.md";

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export async function buildPrivateDataChatRetrievalReview() {
  const semanticPackage = buildPrivateDataChatSemanticContextPackage({
    sourceRetrievedAt: "2026-08-31T00:00:00.000Z",
  }).package;
  const report = await runPrivateDataChatRetrievalBenchmark({
    package: semanticPackage,
    repetitions: 3,
  });
  const ropReport = runPrivateDataChatRopEntryBenchmark({
    resource: getGeneratedRopCodeResource(),
    repetitions: 3,
  });
  const failures = report.cases.filter(
    (testCase) =>
      (testCase.critical && !testCase.requiredSetCovered) ||
      testCase.forbiddenSelected.length > 0 ||
      !testCase.repeatable,
  );
  const markdown = `# Private Qwen semantic retrieval benchmark v1

Generated deterministically from the frozen human-labeled ${report.version} corpus. No Qwen inference, production prompt, production row, credential, or automated LLM judge is used in this gate.

## Selected runtime tier

**Exact reviewed aliases + private PostgreSQL full-text retrieval.** This is the smallest tier that passes every critical release gate. Dense embedding and reranking remain undeployed unless the Samson bakeoff demonstrates the predeclared material gain without resource or generative-queue regression.

## Results

| Metric | Result |
| --- | ---: |
| Cases | ${report.metrics.caseCount} |
| Exact/resolver critical Recall@1 | ${percent(report.metrics.exactCriticalRecallAt1)} |
| Critical required-set coverage | ${percent(report.metrics.criticalRequiredSetCoverage)} |
| Held-out Recall@6 | ${percent(report.metrics.holdoutRecallAt6)} |
| Held-out nDCG@6 | ${report.metrics.holdoutNdcgAt6.toFixed(4)} |
| MRR | ${report.metrics.mrr.toFixed(4)} |
| Forbidden selections | ${report.metrics.forbiddenSelectionCount} |
| Off-topic clarification/abstention | ${percent(report.metrics.clarificationAccuracy)} |
| Maximum serialized context | ${report.metrics.maximumContextBytes} bytes |
| In-process lexical p95 | ${report.metrics.lexicalP95Ms.toFixed(4)} ms |
| Repeatable across three runs | ${report.metrics.repeatable ? "Yes" : "No"} |

## ROP entry-search holdout

| Metric | Result |
| --- | ---: |
| Cases | ${ropReport.metrics.caseCount} |
| Exact code/name Recall@1 | ${percent(ropReport.metrics.exactRecallAt1)} |
| Recall@6 | ${percent(ropReport.metrics.recallAt6)} |
| Hard-negative accuracy | ${percent(ropReport.metrics.hardNegativeAccuracy)} |
| In-process p95 after private-index construction | ${ropReport.metrics.p95Ms.toFixed(4)} ms |
| Repeatable across three runs | ${ropReport.metrics.repeatable ? "Yes" : "No"} |

## Samson Qwen3 embedding/reranker bakeoff

The frozen 36-case corpus was also run on Samson against pinned Q8 candidates. The final sanitized selection receipt is /var/lib/accelerate-llm/evaluations/private-data-chat-rag-20260831-r2/final-selection.json (SHA-256 513dbc4043d70da75ebd1694adb11b9c4cf07a72401793847e1f1e000610a429).

| Tier | Exact critical Recall@1 | Critical set coverage | Held-out Recall@6 | Held-out nDCG@6 | p95 | Production selection |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Exact + PostgreSQL lexical | 100.00% | 100.00% | 100.00% | 0.7568 | ${report.metrics.lexicalP95Ms.toFixed(2)} ms in-process | **Selected** |
| Qwen3 embedding + exact RRF | 100.00% | 100.00% | 100.00% | 0.7885 | 166.08 ms query embedding | Rejected on concurrency |
| Qwen3 reranker | 83.33% | 90.63% | 81.25% | 0.5711 | 24,526.24 ms | Rejected on quality and latency |

The hybrid tier cleared the isolated three-point nDCG material-gain rule, and Samson still had 28.41% memory available with no swap. It nevertheless failed the governing capacity gate: a concurrent representative Qwen planner probe completed only 2/3 calls and reached 96,771.06 ms p95 versus a clean 19,475.76 ms baseline—a 396.88% degradation. The approved gate permits no new failures and at most 5% degradation. Both temporary loopback candidate services were stopped; their pinned artifacts and receipts remain private for reproducibility, not production serving.

## Gates

${Object.entries(report.gates)
  .map(([key, passed]) => `- ${passed ? "PASS" : "FAIL"}: ${key}`)
  .join("\n")}

## Release-blocking failures

${failures.length === 0 ? "None." : failures.map((failure) => `- ${failure.id}`).join("\n")}

## Method

- Relevance sets, hard negatives, partitions, and demonstration eligibility were frozen before tuning.
- Exact key/alias precedence runs before lexical ranking.
- Dataset, audience, sensitivity, and query-authority filters run before ranking.
- Typed dependencies are expanded and required evidence is pinned.
- Context is capped at six items, two train-only demonstrations, and 8 KiB.
- Deterministic plan, compiler, SQL/result, evidence, and security assertions remain separate authoritative gates.
- ROP entry retrieval covers exact hierarchy codes/names plus reviewed descriptions, place, language, geography, status, join issue, and hard-negative behavior; version and permission isolation remain database/application security gates.
- Qwen3-Embedding-0.6B and Qwen3-Reranker-0.6B were tested, not assumed. Production remains on the smaller lexical tier because the complete quality-and-capacity decision, not isolated ranking gain, is authoritative.
`;
  return { markdown, report, ropReport };
}

async function main() {
  const { markdown, report, ropReport } = await buildPrivateDataChatRetrievalReview();
  if (process.argv.includes("--write")) {
    await writeFile(OUTPUT, markdown, "utf8");
  }
  const passed = report.passed && ropReport.passed;
  console.log(JSON.stringify({
    output: OUTPUT,
    passed,
    semanticMetrics: report.metrics,
    ropMetrics: ropReport.metrics,
  }, null, 2));
  if (!passed) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void main();
}
