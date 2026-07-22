## 1. Data model and contracts

- [x] 1.1 Generate a Supabase migration for private forming runs/findings, lifecycle and checksum constraints, indexed foreign keys, append-only protections, RLS/revokes, and API-output artifact checksums.
- [x] 1.2 Extend the Drizzle schema, API types, validation schemas, and schema regression tests for the forming lifecycle.
- [x] 1.3 Add database security/constraint tests covering browser-role denial, valid lifecycle records, immutable finalized bindings/findings, and foreign-key cleanup/restriction behavior.

## 2. Deterministic IMB formation

- [x] 2.1 Add the versioned/checksummed IMB field contract, including written scripture and provenance fields, with exact contract tests.
- [x] 2.2 Implement the pure forming engine for stable row identity, field projection, semantic conversion, country resolution, exact ROP3 hierarchy resolution, row preservation, findings, summaries, and deterministic output checksums.
- [x] 2.3 Add characterization fixtures/tests for valid formation, country conflicts/fill, missing ROP3 preservation, ROP parent disagreement, invalid optional values, schema drift, duplicate/missing object IDs, and deterministic reruns.

## 3. Persistence and lifecycle

- [x] 3.1 Add forming artifact storage paths and immutable upload/download/cleanup helpers in the existing private API connection artifact bucket.
- [x] 3.2 Add resource-set binding loaders and archived API-run output readers/checksums needed by the forming service.
- [x] 3.3 Implement background candidate start/execution, batched finding persistence, finalization, listing/detail/download, rejection, warning acknowledgement, and guarded publication through existing dataset version behavior.
- [x] 3.4 Change only IMB import runs to archive source output without immediate dataset creation and correct stable ArcGIS page-zero ordering; preserve every other provider's import behavior.
- [x] 3.5 Add focused service/provider tests for eligibility, exact input binding, lifecycle transitions, artifact cleanup, publish/retry behavior, IMB import separation, and stable ArcGIS pagination.

## 4. Admin API and review UI

- [x] 4.1 Add centralized-guard admin routes and route tests to build, list, inspect, download, reject, and publish IMB forming candidates.
- [x] 4.2 Extend connection/run response hydration and the existing run-detail sheet with IMB forming status, pinned metadata, counts, findings, artifact downloads, build/retry, reject, warning acknowledgement, and publish controls.
- [x] 4.3 Update connection detail component tests and literal smoke attributes/journeys for the new candidate review and confirmation interactions.

## 5. Documentation and verification

- [x] 5.1 Update current-state/operator documentation for IMB ingestion, candidate review, publication, warning meaning, resource-set binding, retry, and rollback behavior.
- [x] 5.2 Run `pnpm run verify:change`, complete every listed direct/required check including `pnpm run smoke:check`, and resolve all product, test-gap, harness, or environment failures.
- [x] 5.3 Run `pnpm run verify:change:run`, verify the OpenSpec implementation against its artifacts, and leave the completed change ready to archive before the ship-local gate.
