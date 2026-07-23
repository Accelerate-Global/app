## 1. Pipeline and release persistence

- [x] 1.1 Add private pipeline definition/run/input/artifact/finding/publication and release-set/member schema, constraints, RLS, revokes, and indexes.
- [x] 1.2 Add transactional release finalization with completeness/checksum/stale-state validation and immutability tests.
- [x] 1.3 Add generic post-forming build/review/reject/publish services, guarded APIs, and failure/rollback tests.

## 2. Tier 1 merge products

- [x] 2.1 Implement pinned priority parsing, fallback findings, deterministic winner/tie policy, and provenance with matrix/permutation tests.
- [x] 2.2 Implement canonical PGIC merge with collision and lineage tests.
- [x] 2.3 Implement specific-PG ROP3+ISO3 merge with unmatched-row isolation and contributor tests.
- [x] 2.4 Implement versioned workers-needed rule with boundary/invalid tests.

## 3. Aggregate 1 products

- [x] 3.1 Implement PGAC grouping, population sums, weighted/truncated percentages, country selection, alternatives, Joint, and provenance tests.
- [x] 3.2 Implement Self-Engaged and Watchlist provenance-aware thresholds with exact boundary tests.
- [x] 3.3 Implement Baseline UUPG, deterministic top-ten Hotspots, and South Asia scope with parent-binding tests.

## 4. Admin operations and verification

- [x] 4.1 Add release selection, pipeline history/review, out-of-date state, findings, downloads, and publish controls with accessibility/smoke coverage.
- [x] 4.2 Add sanitized and retained side-by-side comparison reports with explained differences.
- [x] 4.3 Document run order, review, retry, rollback, stable targets, and optional post-publish Sheet export.
- [x] 4.4 Pass focused/property/database/security/smoke/OpenSpec/terminal verification, verify the change, and archive it.

## 5. Published dataset integrity

- [x] 5.1 Protect pipeline-owned datasets, rows, versions, classification, tags, and deletion in the service, generic APIs, admin UI, and database triggers.
- [x] 5.2 Add direct-server transaction authorization plus permanent, concurrency-safe current/version storage-path claims and reference-aware storage deletion.
- [x] 5.3 Pass route/service/UI, pgTAP security, transaction-expiry, concurrent-claim, type, lint, smoke, and terminal verification for the integrity boundary.
