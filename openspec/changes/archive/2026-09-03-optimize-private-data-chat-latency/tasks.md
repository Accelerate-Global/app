## 1. Baseline and Design

- [x] 1.1 Run `pnpm run task:kickoff` and `pnpm run verify:change` before implementation.
- [x] 1.2 Inspect the live Samson VM 200, tunnel LXC 105, llama.cpp/gateway services, Vercel request evidence, Cloudflare relay tooling, prompt/schema size, and current cold/warm evaluation receipts without exposing secrets or private data.
- [x] 1.3 Capture a current read-only production scalar baseline and separate planner prompt/generation, deterministic handoff/query, grounded-answer prompt/generation, and provider overhead.

## 2. Deterministic Fast Path

- [x] 2.1 Return evidence-rendered analytical results directly after the verified read-only query and preserve signed turn state/provenance.
- [x] 2.2 Update focused orchestrator tests to prove the narrator is skipped while planner, compiler, broker, exact facts, completeness, and fallback contracts remain intact.

## 3. Evidence and Verification

- [x] 3.1 Collect warm and controlled-cold before/after p50/p95 evidence, including relay overhead and concurrent busy rejection.
- [x] 3.2 Run focused tests, the repository-required commands from `pnpm run verify:change`, and `pnpm run verify:change:run`.
- [x] 3.3 Confirm the exact model/runtime/prompt/schema/catalog/compiler hashes reuse the current complete frozen 1,122-plan/114-answer receipts, and run live read-only scalar plus concurrent-busy production canaries without weakening rubrics.
- [x] 3.4 Document results, make the full post-deploy production canary a durable release requirement, verify the OpenSpec change, archive it after all local gates pass, and prepare the separate pull request.
