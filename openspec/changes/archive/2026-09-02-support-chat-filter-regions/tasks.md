## 1. Regression Contract

- [x] 1.1 Add direct failing tests for India total population, South Asia total population, people-group count distinction, exact aliases, unknown geography, ambiguous/mixed scope, stale checksum, and adversarial region-like text.
- [x] 1.2 Add frozen deterministic-resolver and end-to-end evaluation cases that reproduce the two production refusals without storing production result values.

## 2. Deterministic Geography Resolution

- [x] 2.1 Extract one ordered filter-region source/checksum loader shared by semantic snapshot construction and runtime resolution.
- [x] 2.2 Implement exact canonical/compatibility-alias region matching with ambiguity, empty membership, Global, 50-country bound, and checksum-drift failure states.
- [x] 2.3 Apply resolved region membership as a trusted country predicate after view inheritance and before country-resource normalization/parameterized compilation.

## 3. Retrieval and Planning

- [x] 3.1 Add bounded server-verified resolver views that pin only approved country/metric cards and cannot be supplied by unsigned client state.
- [x] 3.2 Map the exact natural “how many people” grammar to `total_population` while preserving explicit “people groups” and record-count behavior.
- [x] 3.3 Build the existing typed query deterministically for resolved scalar geography intents, bypass Qwen planning/narration, and leave complex planning, region grouping, and arbitrary geography unchanged.

## 4. Verification and Release

- [x] 4.1 Run direct tests, `pnpm run verify:fast`, `pnpm run smoke:check` if impacted, and every command required by `pnpm run verify:change`.
- [x] 4.2 Prove exact compatibility with the fully passing v5 pinned-Qwen planner/answer receipt by hash, run targeted deterministic fast-path and safety-negative repetitions, and verify that Samson requires no configuration change.
- [x] 4.3 Run `pnpm run verify:change:run`, verify OpenSpec completeness, sync the three capability specs, and prepare the completed change for archive.

## Post-archive release follow-through

Repository policy requires the OpenSpec change to be archived before release. After archival, run `pnpm run verify:ship:local`, ship a separate PR through all required gates, verify Release Health, and execute Blake-only production canaries for India, South Asia, people-group count, unknown geography, and off-topic refusal. Verify fast-path latency, Vercel/browser logs, and Samson/tunnel health.
