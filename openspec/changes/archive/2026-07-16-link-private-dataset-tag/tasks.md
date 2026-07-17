## 1. Planning and Domain Contract

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope` for the owned tag, dataset mutation, edit UI, migration, and test paths; record the required commands and Supabase/smoke lanes.
- [x] 1.2 Add the canonical reserved red `Private` tag constants and helpers for detection, filtering, visibility composition, and reusable-tag exclusion.
- [x] 1.3 Extend same-stem dataset-tag tests for canonical add/remove, duplicate and case normalization, preserved classification/user tags, and reserved reusable-tag behavior.

## 2. Persistence and Migration

- [x] 2.1 Compose dataset tags from effective workspace visibility in the dataset summary/mutation domain, including visibility-only updates and derived datasets.
- [x] 2.2 Add a Supabase migration that canonicalizes tags on insert/update and backfills existing datasets without changing RLS or access roles.
- [x] 2.3 Extend database SQL tests for restricted/visible transitions, inconsistent direct writes, legacy visibility alias updates, and preserved non-system tags.

## 3. Admin UI Behavior

- [x] 3.1 Update the dataset edit form to show the linked red `Private` tag immediately, exclude it from freeform editors and saved tags, and submit visibility-consistent tags.
- [x] 3.2 Extend the dataset edit component tests for both toggle directions, non-editable system-tag treatment, reserved-label rejection, and PATCH payloads.
- [x] 3.3 Extend dashboard grid and UI smoke coverage so restricted rows visibly render `Private` while visible rows do not.

## 4. Verification and Completion

- [x] 4.1 Run focused tag, dataset, edit-form, dashboard, validation, migration, and database tests plus `pnpm run smoke:check` and `pnpm run verify:fast`.
- [x] 4.2 Run every command required by the final `pnpm run verify:change`, then pass `pnpm run verify:change:run` on the candidate tracked tree.
- [x] 4.3 Verify the change artifacts against implementation and mark all active OpenSpec implementation tasks complete.
- [x] 4.4 Stop repo-local Supabase/Docker services, prune transient builder cache, and confirm named persistent data was preserved.
