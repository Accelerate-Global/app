## 1. ROP refresh persistence

- [x] 1.1 Add a forward Supabase migration that admits the recognized `missing-rop2` join warning and still rejects unknown values.
- [x] 1.2 Add schema and database regression coverage for the corrected join-issue constraint.

## 2. Resource presentation

- [x] 2.1 Replace visible `Retrieved` wording with `Updated` and remove active version labels from resource catalog and detail components.
- [x] 2.2 Update the focused resource component and page tests for the simplified metadata.

## 3. Super-admin account deletion

- [x] 3.1 Implement server-side deletion guards and the session, Auth user, and allowlist deletion sequence.
- [x] 3.2 Add the protected `DELETE /api/admin/users/:userId` contract and focused route/domain tests.
- [x] 3.3 Add the super-admin-only confirmation UI, list update behavior, canonical invite role label, aligned controls, and smoke markers.
- [x] 3.4 Update User Management component tests and route smoke coverage for the new behavior.

## 4. Verification and completion

- [x] 4.1 Run `pnpm run verify:change`, complete every listed required command, and run `pnpm run verify:change:run`.
- [x] 4.2 Verify the relevant UI behavior and ROP refresh persistence path without deleting a real account.
- [x] 4.3 Verify the OpenSpec change and sync the delta specs; archive the completed change afterward.
