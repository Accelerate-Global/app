## 1. Source profiles and persistence

- [x] 1.1 Add stable code-managed profile metadata for IMB, Etnopedia, and Joshua Project.
- [x] 1.2 Add private Google Sheets source-profile bindings, uniqueness constraints, RLS/revokes, and migration/security tests.
- [x] 1.3 Add guarded administrator APIs and validation for binding WCD/Accelerate profiles and durable key columns.

## 2. Shared source-contract primitives

- [x] 2.1 Add deterministic mapping, type conversion, country, ROP, stable-key, duplicate, finding, and checksum helpers with direct tests.
- [x] 2.2 Add immutable field/type/transformation contracts and fixed checksums for AX, ETNO, JP, WCD, and IMB.
- [x] 2.3 Add sanitized golden inputs/expected rows/findings for every source and schema-drift case.
- [x] 2.4 Enforce DEC-010 by blocking invalid semantic conversions and missing contract-required mapped values with direct regressions.

## 3. Tier 1 forming engines

- [x] 3.1 Implement and test Etnopedia forming with stable page identity and unresolved-row preservation.
- [x] 3.2 Implement and test Joshua Project forming with PeopleID/resource fields and blocking complete-key duplicates.
- [x] 3.3 Implement and test WCD forming with configured stable key, exact country aliases, ROP People fallback, and types.
- [x] 3.4 Implement and test Accelerate-owned forming with profile-specific stable key, mappings, country, types, and duplicates.
- [x] 3.5 Keep IMB registered and pass whole-output parity after shared primitive adoption.

## 4. Lifecycle, ingestion, and publication

- [x] 4.1 Stage all engine-managed import snapshots without direct dataset publication while preserving unregistered imports.
- [x] 4.2 Execute every registered engine through generic build/rebuild/reject/download/publish services and routes.
- [x] 4.3 Publish each profile through the atomic prepared-dataset boundary and retain exact candidate/publication lineage.
- [x] 4.4 Add lifecycle failure/retry tests for missing identity, duplicates, resource change, checksum drift, and storage/DB rollback.

## 5. Admin UI and operations

- [x] 5.1 Render engine/profile labels and source-specific summaries in the existing generic run-detail sheet.
- [x] 5.2 Add minimal admin profile binding controls for eligible Google Sheets connections with accessibility and smoke attributes.
- [x] 5.3 Add route/component/UI smoke coverage for one full candidate lifecycle per source class: code-managed and configurable Google Sheets.

## 6. Documentation and verification

- [x] 6.1 Document profile configuration, stable-key requirements, source differences, build/review/publish, rollback, and operator recovery.
- [x] 6.2 Run focused tests, `pnpm run verify:fast`, `pnpm run smoke:check`, database security, and `pnpm run spec:validate` to green.
- [x] 6.3 Run `pnpm run verify:change`, complete its required commands, and pass `pnpm run verify:change:run`.
- [x] 6.4 Verify and archive this change before pre-ship validation.
