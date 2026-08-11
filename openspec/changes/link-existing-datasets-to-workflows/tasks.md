## 1. Planning and contracts

- [x] 1.1 Inspect the existing onboarding assignments, connection-detail controls, Tier 1 bindings, Tier 2 profiles, and relevant specs.
- [x] 1.2 Create and validate the OpenSpec proposal, design, and delta specifications.
- [x] 1.3 Run `pnpm run task:kickoff` and `pnpm run verify:change`; record the required verification lane and smoke subset.

## 2. Shared workflow assignment

- [x] 2.1 Refactor the existing onboarding assignment validation/persistence into reusable server-side functions without changing onboarding behavior.
- [x] 2.2 Add an administrator endpoint that reads and creates one existing-connection workflow assignment atomically.
- [x] 2.3 Preserve connection/dataset/history state, update classification in the transaction, and reject conflicts or incomplete reviewed fields without partial writes.
- [x] 2.4 Add focused schema, persistence, route, authorization, and rollback regression tests.

## 3. Connection detail experience

- [x] 3.1 Replace the Tier 1-only forming control with a workflow assignment control supporting unlinked, Tier 1, and Tier 2 choices.
- [x] 3.2 Display an active assignment read-only and make it explicit that saving configuration does not start ingestion, forming, publication, schedules, or identity work.
- [x] 3.3 Update UI smoke attributes/fixtures and focused component tests for the new surface.

## 4. Source profiling review gate

- [x] 4.1 Profile Final-58 and Final-Sudan read-only for headers, null rates, uniqueness, tracking-source distributions, and candidate evidence fields.
- [x] 4.2 Produce proposed exact mappings and identify any contract gap, without creating production profiles or changing identity/publication state.
- [x] 4.3 Present the mapping and identity-authority gate to the user for consultation before canary configuration.
- [x] 4.4 Extend Tier 2 profiles, persistence, UI, and forming to support a reviewed row-level tracking-source map with no fallback.
- [x] 4.5 Add and verify permanent source-row IDs in Final-58 and Final-Sudan without changing existing source values.
- [ ] 4.6 Link and run Final-58 as a forming-only canary, compare its candidate with retained source evidence, and stop before identity allocation or publication.

## 5. Verification and closure

- [x] 5.1 Run focused tests, `pnpm run smoke:check`, and every command required by `pnpm run verify:change`.
- [x] 5.2 Run `pnpm run verify:change:run` successfully and classify/fix any failures.
- [x] 5.3 Verify the local administrator workflow end to end while confirming no ingestion or publication side effect.
- [x] 5.4 Update tasks with completed evidence; leave the OpenSpec change active until the approved production canary is implemented and verified.
