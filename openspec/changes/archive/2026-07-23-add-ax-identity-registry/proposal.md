## Why

Tier 1 source candidates need authoritative, stable AX PGAC/PGIC identities before they can be merged. The legacy CSV/Sheet ledgers allocate identifiers with whole-file `max + 1`, accept collisions, and resolve duplicate row keys by physical order, which is unsafe for concurrent online execution and cannot provide immutable audit history.

## What Changes

- Add a private transactional AX identity registry with canonical codes, aliases, source bindings, revisions, and non-recycling namespace counters.
- Implement deterministic ROP3-based PGAC/PGIC construction and locked six-digit allocation for rows without ROP3.
- Characterize one fixed checksummed legacy ledger manifest as canonical PGAC →
  PGIC identities plus complete historical binding evidence through a CLI-only
  dry-run/fingerprint handshake. Positional legacy keys remain unbound and
  cutover stays blocked until exact current source snapshots can prove a
  repository-reviewed runtime crosswalk; never resolve a latest file or accept
  a flat production API import.
- Add an identity candidate stage after source forming with reviewable reuse, retention, allocation, conflict, and unassignable findings.
- Publish identity-enriched datasets and authoritative registry bindings through one controlled administrator decision.
- Add an admin-only searchable identity history surface.
- Non-goals: arbitrary canonical-code editing, source merging, or aggregate publication.

## Capabilities

### New Capabilities

- `ax-identity-registry`: Transactional canonical/alias identity, allocation, source binding, revision, import, and audit behavior.
- `identity-candidate-runs`: Reviewable identity enrichment between formed source publication and merge eligibility.

### Modified Capabilities

- `dataset-forming-platform`: Published formed candidates can become immutable inputs to identity runs.
- `tier1-source-forming`: Curated Tier 1 sources receive identity-enriched publication lineage without changing their formed evidence.

## Impact

- Private Supabase registry, counter, code, source-binding, revision, pipeline-run, finding, artifact, and publication tables/functions.
- Pure identity normalization/formula/graph-import/reconciliation modules and concurrency tests.
- Admin APIs and one registry/history UI page with required route/smoke coverage.
- No browser-role table access, no new external service, and no runtime AX Data dependency.
