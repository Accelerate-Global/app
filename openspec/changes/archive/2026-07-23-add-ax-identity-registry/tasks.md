## 1. Registry schema and security

- [x] 1.1 Add private publication, registry revision, counter, identity, code, source-binding, identity-run, finding, and artifact tables with indexed restrictive lineage.
- [x] 1.2 Add uniqueness, shape, immutable-history, non-recycling, reservation, and lifecycle constraints/triggers.
- [x] 1.3 Add private security-definer allocation/activation functions with safe search paths and browser execution revokes.
- [x] 1.4 Add schema, RLS, pgTAP, and real parallel-connection allocation tests.

## 2. Pure identity rules

- [x] 2.1 Implement strict source/ROP1/ROP3/ISO3 normalization and deterministic PGAC/PGIC formulas with boundary/property tests.
- [x] 2.2 Implement idempotent no-ROP3 allocation client/service behavior with retry, exhaustion, collision, cancellation, and non-recycling tests.
- [x] 2.3 Implement alias/supersession and reconcile policy with collision and history tests.

## 3. Legacy import and reconciliation

- [x] 3.1 Add an explicit-snapshot dry-run importer with checksum/fingerprint and no latest-file discovery.
- [x] 3.2 Report duplicate keys/codes/UUIDs, aliases, malformed entries, and orphan bindings; refuse blocking commits.
- [x] 3.3 Add idempotent commit and reconciliation against stable Tier 1 source row keys with sanitized fixtures.
- [x] 3.4 Preserve every historical binding as immutable evidence, pin an intentionally blocked crosswalk contract, and prevent cutover/allocation/publication until exact current source snapshots and a reviewed runtime-key crosswalk are added and verified.

## 4. Identity candidate lifecycle

- [x] 4.1 Add build/detail/list/download/reject/publish services and guarded APIs with immutable artifacts/checksums.
- [x] 4.2 Reserve/reuse identities during build and atomically activate bindings, revision, publication, and dataset rows on publish.
- [x] 4.3 Add stale/rejected reservation cleanup without value reuse and lifecycle rollback tests.
- [x] 4.4 Add immutable exact-input attempt lineage so failed, expired, or rejected builds can retry without weakening concurrent idempotency.

## 5. Admin UI and verification

- [x] 5.1 Add an admin-only registry/history/conflict page, route registry entry, literal smoke markers, and accessibility coverage.
- [x] 5.2 Extend source run history to link formed and identity stages with exact publication/revision details.
- [x] 5.3 Document import, conflict remediation, freeze/cutover, rollback, and read-only legacy backup operations.
- [x] 5.4 Pass focused, concurrency, database security, smoke, OpenSpec, `verify:change:run`, verification, and archive gates.
