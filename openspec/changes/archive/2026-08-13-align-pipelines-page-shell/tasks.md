## 1. Planning and Contracts

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope 'src/app/admin/pipeline-operations/**'` after proposal exploration, then record the selected verification lane and Supabase requirement.

## 2. Pipelines Page Alignment

- [x] 2.1 Render the shared authenticated `SiteHeader` within the established admin page shell while preserving literal pipeline smoke markers.
- [x] 2.2 Change the page heading to the canonical `Pipelines` label without renaming routes or internal identifiers.
- [x] 2.3 Update the direct same-stem page test to cover the canonical heading, authenticated account-menu trigger, and existing smoke marker.

## 3. Verification and Completion

- [x] 3.1 Run the direct page test and `pnpm run smoke:check` for focused feedback.
- [x] 3.2 Run every command required by `pnpm run verify:change`, including `pnpm run verify:change:run` as the terminal gate.
- [x] 3.3 Re-run `pnpm run verify:change`, confirm all tasks and artifacts are complete, and archive the OpenSpec change.
