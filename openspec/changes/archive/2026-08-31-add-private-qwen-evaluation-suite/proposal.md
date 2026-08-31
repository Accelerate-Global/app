## Why

The current private-data-chat release corpus has 23 strong golden planner cases, but it is too small to characterize how reliably Qwen handles the breadth of natural-language questions, follow-up conversations, grounded explanations, and adversarial inputs that administrators will use against Accelerate Global data. A larger review-first suite is needed so humans can approve the exact questions and expected behavior before any live Samson or production evaluation consumes model capacity or accesses data.

## What Changes

- Add a versioned, structured capability-evaluation corpus that expands planner, clarification, refusal, multi-turn, answer-grounding, value-resolution, and failure-behavior coverage.
- Organize cases by tier, capability, risk, and expected decision so reviewers can understand both breadth and release-critical subsets.
- Add deterministic static validation for unique identifiers, catalog-current plans, safe compilation, complete coverage metadata, and answer rubrics without contacting Qwen or a database.
- Add a deterministic review exporter that produces a human-readable Markdown inventory containing every proposed prompt, conversation, expected semantic outcome, and scoring rubric.
- Keep live execution explicitly separate and opt-in; generating or validating the review corpus MUST NOT call Samson, the production chat API, Cloudflare, Vercel, or Supabase.
- After explicit approval, export a hash-bound live-evaluation bundle, execute the full extended suite against the pinned local Qwen candidate and approved production canary path, and retain sanitized receipts.
- Document estimated inference volume and a staged execution sequence for later approval.
- Preserve the existing 23-case release corpus as a compatibility baseline inside the expanded suite.

### Non-goals

- This change does not alter chat UI behavior, authentication, canary permissions, database schema, RLS, analytics-role grants, or compiler policy. Prompt contracts and gateway pins MAY be strengthened only when the approved diagnostic demonstrates a genuine planning or grounding defect.
- This change does not attach live evaluation to CI, establish mutable production values as golden expectations, or publish private result rows.
- This change does not introduce a second LLM judge, vector database, or hosted evaluation service.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `semantic-analytics-query`: Expand semantic regression evaluation into a versioned, review-first capability suite with deterministic static validation, explicit execution tiers, grounded-answer rubrics, and a hard separation between corpus review and live inference.

## Impact

- Primary code: `src/lib/private-data-chat/evaluation-*` and a review-only exporter under `scripts/private-data-chat-*`.
- Documentation: `docs/operations/private-data-chat-evaluation-*`.
- Specification: `openspec/specs/semantic-analytics-query/spec.md` through this change's delta specification.
- Dependencies: no new runtime or development dependency is expected.
- Auth and admin permissions: unchanged.
- Data integrity and Supabase: unchanged; review and static validation perform no database calls.
- Vercel and Cloudflare topology: unchanged. A normal Vercel application deployment and a temporary current-plus-previous gateway prompt-hash overlap are required when diagnostic remediation advances a prompt contract.
- API payload schemas: unchanged; planner and answer prompt versions may advance with new hash pins.
- UI smoke coverage: unchanged because no route or component changes are planned.
- Brownfield evidence: the existing corpus in `src/lib/private-data-chat/evaluation-cases.ts`, static checks in `src/lib/private-data-chat/evaluation-cases.test.ts`, and release receipt policy in `docs/operations/private-data-chat-evaluation-v3.md` remain the baseline.
