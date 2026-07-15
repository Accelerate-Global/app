## 1. Planning and fixtures

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope "src/lib/google-sheets*,src/lib/api-connections/**,src/app/api/admin/api-connections/google-sheets/**,src/components/dashboard/api-connections*,src/lib/api-types.ts,tests/ui/**,docs/user/**"`; record required commands, targeted smoke, and local Supabase need before application edits.
- [x] 1.2 Add minimal synthetic Sudan/Lao-style fixtures covering sparse report rows, numeric guides, row-four headers, genuine multi-row composition, and data rows without committing private source data.

## 2. Header detection and parsing

- [x] 2.1 Extend Google Sheets types with bounded header preview, candidate, confidence, selection, composed-label, and fingerprint contracts while preserving legacy provider-config compatibility.
- [x] 2.2 Implement deterministic single-row scoring, confidence, one-to-three-row composition, merged-label expansion, fingerprints, sample previews, and exact-fingerprint relocation.
- [x] 2.3 Update Google Sheets run parsing to use confirmed selections, safely relocate unchanged headers, block material drift, and use high-confidence compatibility detection for legacy connections.
- [x] 2.4 Add focused Google Sheets and provider tests for clean headers, report/reference rows, numeric guides, manual rows, multi-row composition, relocation, ambiguity, and no source-data mutation.

## 3. Provider-specific admin APIs and persistence

- [x] 3.1 Add an admin-only bounded header-preview route that resolves stable `sheetId`, returns candidates and samples, and exposes no credentials.
- [x] 3.2 Extend Google Sheets connection creation to accept one server-revalidated selection per selected tab and persist only normalized header configuration metadata.
- [x] 3.3 Add an admin-only existing-connection header update operation that validates live Sheet values before persisting and preserves the current target dataset until a later explicit refresh.
- [x] 3.4 Add or update same-stem route/domain tests for authorization, request validation, server-side recomputation, legacy compatibility, and error normalization.

## 4. Connection UI and import completion

- [x] 4.1 Add lazy per-tab header preview and a recommended one-based Header row selector to connection setup, including exact column/sample preview and low-confidence review state.
- [x] 4.2 Add an advanced consecutive one-to-three-row combine option and ensure any override becomes an explicit manual selection.
- [x] 4.3 Add header review/edit controls to active Google Sheets connection detail and persist changes only after confirmation.
- [x] 4.4 When polling observes terminal import success or failure, update the queued message; on success refresh server connection state once so **Open dataset** appears automatically.
- [x] 4.5 Add component tests and literal smoke trigger/surface/ready markers for header review and post-import navigation; update targeted UI smoke coverage.

## 5. Documentation and verification

- [x] 5.1 Update user documentation for automatic detection, manual row selection, multi-row composition, drift review, corrected row counts, and safe refresh behavior.
- [x] 5.2 Run direct tests for every changed module and component, then `pnpm run verify:fast` and `pnpm run smoke:check`; classify and fix every failure.
- [x] 5.3 Run every required command reported by `pnpm run verify:change`, including targeted browser smoke and local Supabase/security checks when required.
- [x] 5.4 Run `pnpm run spec:validate`, rerun `pnpm run verify:change`, and pass `pnpm run verify:change:run` on the final tracked tree.
- [ ] 5.5 Verify the implementation against this OpenSpec change, archive it, and pass `pnpm run verify:ship:local` before publication.

## 6. Publication and production remediation

- [ ] 6.1 Create a focused branch, commit the complete partner-export and Google Sheets header work, push it, open a pull request, and complete the repository ship workflow.
- [ ] 6.2 Verify the production connection/header flow end-to-end, save row 4 for the existing Sudan source, refresh its dataset, and confirm **Open dataset**, corrected labels, and 126 non-empty data rows.
