## Why

Valid questions such as “How many people are in India?” and “How many people are in South Asia?” are currently refused before planning because natural population phrasing is not recognized and reviewed filter-region names are not executable chat filters. This leaves basic dataset exploration behind the capabilities already present in the dataset UI.

## What Changes

- Recognize “how many people” as the approved `total_population` metric while preserving “how many people groups” as `people_group_count`.
- Resolve exact reviewed filter-region names and compatibility aliases, including `South Asia` → `Asia, South`, against the existing region registry.
- Bind region resolution to the filter-region checksum in the active semantic snapshot and fail closed on drift or ambiguity.
- Apply the resolved region deterministically as the exact approved country set before parameterized SQL compilation; Qwen never invents the country membership.
- Use an application-owned typed fast path for these exact scalar intents so they do not depend on Qwen planning or narration.
- Add regression and adversarial cases for India, South Asia, region aliases, stale definitions, unknown geographies, country/group-count distinctions, and prompt-injection-shaped values.

Non-goals: adding a free-form continent/world-geography ontology, permitting model-authored joins or SQL, grouping results by region, changing UUPG semantics, widening the Blake-only production canary, or weakening off-topic refusal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `private-data-chat`: Valid natural population and reviewed filter-region questions produce grounded data answers instead of off-topic refusals.
- `semantic-analytics-query`: Exact reviewed region aliases resolve to version-bound country predicates under deterministic query authority.
- `semantic-context-retrieval`: Trusted region resolution can pin approved country/metric evidence while unrecognized geography remains outside the reviewed scope.

## Impact

- Application: `src/lib/private-data-chat` retrieval, orchestration, deterministic geography resolution, evaluation, and tests.
- Existing data: read-only use of `filter_regions`, `filter_region_countries`, and the active country resource; no database schema or migration change.
- Runtime contract: unchanged; the exact fast path bypasses Qwen while complex chat keeps the pinned gateway contract.
- Auth/admin/data integrity: unchanged; authorization, read-only analytics, parameterization, and the exact canary remain intact.
- Vercel: a normal production deployment is required; Samson configuration does not change.
- UI smoke: no new route or surface; existing chat journey coverage is extended only if required by the change-impact gate.
