## 1. Plan and Contract

- [x] 1.1 Run `pnpm run verify:change` and the scoped task kickoff before implementation.
- [x] 1.2 Define the semantic-catalog, version-binding, controlled-value, answer-grounding, and evaluation behavior in OpenSpec.

## 2. Semantic Catalog

- [x] 2.1 Upgrade the catalog to a checksum-bound v2 snapshot with dataset grain, safe field/metric semantics, aliases, units, null behavior, value domains, compatibility, sensitivity, provenance, freshness, and explicit join policy.
- [x] 2.2 Add catalog renderers and reconciliation checks that reuse canonical field/source/reference vocabulary without exposing compiler-only mappings or mutable metadata.
- [x] 2.3 Add direct catalog and prompt tests for checksum drift, source compatibility, completeness, and inference-boundary redaction.

## 3. Typed Planning and Value Resolution

- [x] 3.1 Require the exact catalog revision in query decisions and the inference JSON schema, then reject stale plans before compilation.
- [x] 3.2 Resolve active country names, aliases, and codes deterministically; clarify ambiguous matches, preserve unknown values as inert parameters, and fail closed when the required resource is unavailable.
- [x] 3.3 Wire value resolution and one bounded repair into orchestration with direct schema, resolver, compiler, and orchestration tests.

## 4. Grounded Answers and Evaluation

- [x] 4.1 Generate selected safe semantic context for answer inference and verify physical mappings, SQL expressions, credentials, and unselected definitions are excluded.
- [x] 4.2 Expand sanitized golden cases across supported, ambiguous, unsupported, adversarial, multi-turn, alias, null/boundary, and security behavior with compile/parameter assertions.
- [x] 4.3 Update the deterministic fake and database integration expectations for catalog v2 without changing browser-facing chat behavior.

## 5. Documentation and Verification

- [x] 5.1 Update the private-data-chat runbook with the catalog lifecycle, metadata ownership, value-resolution behavior, evaluation gates, and rollback path.
- [x] 5.2 Run direct private-data-chat tests, `pnpm run verify:fast`, `pnpm run spec:validate`, and every command selected by a fresh `pnpm run verify:change` plan.
- [x] 5.3 Run `pnpm run verify:change:run`, resolve all product/test/harness/environment failures, and complete OpenSpec verification.
- [x] 5.4 Run the pinned real-Qwen suite for three deterministic repetitions and retain a passing hash-verified candidate receipt.

## 6. Archive and Release

- [x] 6.1 Sync the verified delta specs, revalidate the durable specification state, and confirm archive readiness before the separate release workflow.
