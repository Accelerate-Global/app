## 1. Baseline and contracts

- [x] 1.1 Validate and retain the existing Google Sheets visibility/private-tag implementation, migration, tests, and archived OpenSpec artifacts in the combined branch.
- [x] 1.2 Add the onboarding OpenSpec proposal, design, delta specs, and task checklist and pass strict OpenSpec validation.
- [x] 1.3 Run the repository change planner/kickoff and record the required commands, targeted smoke subset, and local Supabase requirements.

## 2. Onboarding state and route

- [x] 2.1 Add the administrator-only `/dashboard/datasets/new` page with literal smoke markers, source deep links, and route-registry coverage.
- [x] 2.2 Implement and test the reducer/state types for staged navigation, invalidation boundaries, stale response tokens, import locking, and partial outcomes.
- [x] 2.3 Build and test the accessible responsive onboarding shell, ordered stepper, source choice, focus management, error summary, and polite status announcements.
- [x] 2.4 Add the administrator dashboard Add dataset action and update dashboard component tests.

## 3. Google Sheets onboarding

- [x] 3.1 Extract/reuse service-account access and header-preview client operations in the Google Sheets onboarding stages.
- [x] 3.2 Implement tab selection, compact high-confidence summaries, forced ambiguous review, and expanded one-to-three-row header preview with smoke surfaces.
- [x] 3.3 Extend the connect route/domain/types with backward-compatible per-tab reviewed dataset names and complete route/domain tests.
- [x] 3.4 Implement dataset-name, classification, and explicit workspace-access review using the synchronized Private tag preview.
- [x] 3.5 Implement connect-once import orchestration, per-connection polling, partial success, redacted failures, dataset links, and import-only retry with component tests.

## 4. CSV onboarding and compatible navigation

- [x] 4.1 Extract reusable CSV local validation and upload/parse/persist behavior without changing replacement semantics.
- [x] 4.2 Implement CSV source, structure, reviewed name/classification/access, confirmation, progress, and completion stages with component/API tests.
- [x] 4.3 Redirect `/dashboard/upload` new uploads to CSV onboarding while preserving and testing `?replace={datasetId}`.

## 5. Operations, documentation, and smoke

- [x] 5.1 Refocus API Connections as Data sources, remove inline Sheet creation, correct privacy terminology, and retain operational inventory/resources with updated tests.
- [x] 5.2 Simplify connection detail to real source/status/actions plus collapsed diagnostics and remove disabled pipeline skeleton behavior with updated tests.
- [x] 5.3 Add privacy-safe onboarding analytics and verify no source names, URLs, headers, filenames, or row content are emitted.
- [x] 5.4 Update user documentation for Add dataset, automatic/manual headers, source sharing, imported access, completion, and partner-export handoff.
- [x] 5.5 Update UI smoke route/journey contracts for Google Sheets onboarding, CSV onboarding, Data sources, and legacy redirects.

## 6. Verification and delivery

- [x] 6.1 Run direct unit, component, route, domain, and OpenSpec tests; fix all product, test-gap, and contract failures.
- [x] 6.2 Run `pnpm run verify:fast`, `pnpm run smoke:check`, and the repository-planned targeted UI smoke subset.
- [x] 6.3 Run database security and linked migration-drift checks for the combined private-tag/onboarding branch and preserve local persistent data.
- [x] 6.4 Run `pnpm run verify:change:run`, rerun `pnpm run verify:change`, and complete every listed required command.
- [x] 6.5 Verify the implementation against OpenSpec and resolve every completeness, correctness, and coherence issue before archive.
- [x] 6.6 Prepare the complete reviewed diff and verification evidence for archive and ready pull-request delivery.
