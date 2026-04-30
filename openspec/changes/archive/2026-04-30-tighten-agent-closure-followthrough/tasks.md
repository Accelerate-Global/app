## 1. Policy Update

- [x] 1.1 Run `pnpm run verify:change` before edits.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope AGENTS.md --scope openspec/specs/openspec-automation/spec.md --scope 'openspec/changes/tighten-agent-closure-followthrough/**'`.
- [x] 1.3 Clarify `AGENTS.md` closure-loop rules for executable open items and next steps.
- [x] 1.4 Add a matching OpenSpec delta for `openspec-automation`.

## 2. Verification

- [x] 2.1 Run `pnpm run spec:validate`.
- [x] 2.2 Run required verification after the remote migration drift is resolved.
- [x] 2.3 Stop repo-local Supabase/Docker services and run cleanup if verification starts them.
