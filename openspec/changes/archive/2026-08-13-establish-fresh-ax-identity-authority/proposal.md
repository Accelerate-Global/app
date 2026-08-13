## Why

AX Online currently gates identity allocation behind a legacy AX Data graph import and allows source-supplied AX codes to influence reconciliation. The product instead needs a fresh, independently operated AX identity authority that preserves the established AX code format while using only normalized current-source evidence.

## What Changes

- **BREAKING** Remove the legacy identity importer, AX Data filesystem/configuration dependencies, historical manifests, cutover functions, and legacy identity evidence paths.
- Add a state-bound, CLI-only activation workflow that creates empty registry revision 1 and leaves the non-ROP3 counter at `000001`.
- Preserve the established `ROP1-source-ROP3-or-allocation-ISO3` code format with versioned normalization and formatter checksums.
- Restrict identity evidence to exact formed publications, stable source keys, registered source initials, and pinned current Country/ROP resources; source-supplied old AX codes have no identity effect.
- Reuse exact current ROP3 across sources for PGAC and exact ROP3 plus ISO3 for PGIC; keep no-ROP3 identities source-specific.
- Treat ROP1, source, ROP3, and ISO3 changes as reviewed identity events while ordinary field changes preserve bindings.
- Reuse the current registry revision when the active identity graph is unchanged, while still allowing data-only publications.
- Update the identity review UI, operator documentation, tests, and UI smoke coverage for the fresh-authority lifecycle.

Non-goals:

- Preserve or migrate AX Data identities, codes, bindings, aliases, or historical continuity.
- Add fuzzy/name-based identity matching, automatic aliases, browser activation, schedules, or automatic publication.
- Change unrelated dataset access, authentication, merge arithmetic, or aggregate definitions.

## Capabilities

### New Capabilities
- `ax-identity-authority-initialization`: Empty registry activation, state-bound CLI handshake, authority marker, and hard AX Data isolation.

### Modified Capabilities
- `ax-identity-registry`: Replace legacy cutover requirements with fresh current-source allocation, established code formatting, ROP3 deduplication, and reviewed identity evolution.
- `identity-candidate-runs`: Remove source-retained AX codes, support PGAC-only/unassignable outcomes, and avoid new revisions for unchanged identity graphs.
- `tier1-source-forming`: Pin ROP3-to-ROP1 and country-name-to-ISO3 normalization as identity prerequisites.
- `tier2-source-forming`: Pin the same canonical normalization boundary for Tier 2 identity evidence without AX Data-derived runtime inputs.

## Impact

- Identity service, rules, candidate artifacts, review UI, API responses, and downstream revision compatibility.
- Supabase private schema, privileged functions, RLS/grants, immutable revision data, and private identity artifacts.
- CLI scripts, package commands, repository verification, and operator runbooks.
- The admin identity route and its UI smoke coverage.
- Vercel deploy behavior remains fail-closed until the separate CLI activation; authentication roles remain unchanged.

Brownfield evidence: `src/lib/source-forming/engine.ts` and `src/lib/tier2-products/forming.ts` already normalize ROP parents and geography using pinned resources; `src/lib/identity-registry/service.ts`, `scripts/import-legacy-ax-identity-graph.ts`, and `supabase/migrations/20260723013000_add_legacy_ax_identity_graph_cutover.sql` currently encode the legacy authority dependency that this change replaces.
