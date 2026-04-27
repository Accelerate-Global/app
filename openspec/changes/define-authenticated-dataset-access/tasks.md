## 1. Investigation

- [ ] 1.1 Confirm the final intended behavior for admin-owned saved tables on private datasets.
- [ ] 1.2 Confirm whether anonymous dataset pages should keep redirecting to `/` or use a dedicated sign-in URL if introduced.
- [ ] 1.3 Confirm whether private physical and derived datasets should share identical read/download access semantics.

## 2. Spec Finalization

- [ ] 2.1 Update the spec delta after open questions are answered.
- [ ] 2.2 Review the proposed status-code and redirect matrix with product/security owners.

## 3. Implementation

- [ ] 3.1 Align dataset page access checks with the finalized contract.
- [ ] 3.2 Align dataset JSON APIs, row APIs, and download APIs with the finalized contract.
- [ ] 3.3 Align saved-table read/update/delete/open/download behavior with owner and underlying dataset access rules.
- [ ] 3.4 Update Supabase RLS migrations only if the finalized contract requires database policy changes.

## 4. Tests

- [ ] 4.1 Add or update direct route tests for anonymous, viewer, and admin dataset API access.
- [ ] 4.2 Add or update saved-table tests for ownership and underlying dataset access.
- [ ] 4.3 Add or update page tests for redirect and not-found behavior.
- [ ] 4.4 Update UI smoke route/journey coverage if user-visible route behavior changes.
- [ ] 4.5 Update database security tests if RLS policy behavior changes.

## 5. Documentation And Verification

- [ ] 5.1 Update docs if finalized behavior changes user/admin expectations.
- [ ] 5.2 Run `pnpm run verify:change` before implementation edits.
- [ ] 5.3 Run direct tests selected by the touched files.
- [ ] 5.4 Run `pnpm run smoke:check` and targeted smoke when UI route behavior changes.
- [ ] 5.5 Run `pnpm run db:security` if migrations or RLS policies change.
- [ ] 5.6 Run `pnpm run verify:change:run` before finalizing implementation.
