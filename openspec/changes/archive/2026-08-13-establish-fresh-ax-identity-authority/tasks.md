## 1. Planning and contracts

- [x] 1.1 Run the repository change-planning gate and task kickoff for the identity, database, CLI, UI, documentation, and verification paths
- [x] 1.2 Validate the OpenSpec proposal, design, delta specifications, and implementation checklist
- [x] 1.3 Add repository guard tests proving AX Online has no executable AX Data or legacy identity import dependency

## 2. Fresh authority schema and activation

- [x] 2.1 Generate an additive Supabase migration that fails closed unless the existing authority graph is empty and the counter is at `000001`
- [x] 2.2 Replace legacy cutover/import schema with private activation attempts, the immutable authority marker, ROP3 ownership evidence, and normalized binding evidence
- [x] 2.3 Implement state-fingerprint, dry-run, single-use-token, and atomic revision-1 commit functions with private-schema grants and RLS hardening
- [x] 2.4 Update the Drizzle schema and database contract/security tests for the fresh authority model
- [x] 2.5 Add a CLI-only authority activation command and direct tests for empty, changed-state, replay, and nonempty rejection cases

## 3. Current-source identity engine

- [x] 3.1 Remove source AX-code fields from identity evidence, reconciliation, findings, aliases, output decisions, and artifacts
- [x] 3.2 Revalidate canonical ROP parents and ISO3 against the exact resource versions pinned by forming
- [x] 3.3 Implement established PGAC/PGIC formatting, PGAC-only outcomes, atomic non-ROP3 allocation, and no-allocation unassignable outcomes
- [x] 3.4 Implement exact current ROP3 PGAC and ROP3-plus-ISO3 PGIC reuse across Tier 1 and Tier 2 through authoritative evidence ownership
- [x] 3.5 Preserve stable bindings for data-only changes and require explicit reviewed outcomes for identity-component changes
- [x] 3.6 Make graph revisions checksum-driven so unchanged identity graphs reuse the current revision while changed bindings publish atomically
- [x] 3.7 Update identity artifacts, enriched outputs, downstream consumers, and direct tests for the fresh authority behavior

## 4. Legacy execution isolation

- [x] 4.1 Delete legacy AX identity importer modules, scripts, manifests, package commands, and application cutover checks
- [x] 4.2 Remove AX Data filesystem/environment readers and add static and behavioral tests preventing historical identity influence
- [x] 4.3 Update pipeline and operations documentation to describe the clean authority, current evidence rules, and one-source-at-a-time manual rollout

## 5. Administration UI

- [x] 5.1 Update the identity registry admin UI to report inactive or initialized fresh-authority state without any browser activation control
- [x] 5.2 Add review presentation and supported decisions for current-source identity-component changes
- [x] 5.3 Update direct component tests, route smoke contracts, and targeted browser fixtures for the changed administration flows

## 6. Verification and completion

- [x] 6.1 Run direct unit, integration, migration, database-security, OpenSpec, static isolation, and UI smoke checks required by the planning gate
- [x] 6.2 Run `pnpm run verify:change:run` on the complete tracked candidate tree and resolve every product, test-gap, harness, or environment failure
- [x] 6.3 Verify a clean local activation creates empty revision 1 with counter `000001`, then verify manual first-source behavior without enabling schedules or automatic publication
- [x] 6.4 Archive the completed OpenSpec change after all implementation and repository verification pass
