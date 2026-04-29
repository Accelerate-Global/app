## 1. OpenSpec And Planning

- [x] 1.1 Run `pnpm run verify:change`, `pnpm run task:kickoff -- --scope 'docs/testing/**' --scope 'scripts/**' --scope package.json --scope AGENTS.md --scope 'openspec/**'`, and confirm no unrelated dirty paths before editing.
- [x] 1.2 Create OpenSpec proposal, design, delta spec, and implementation tasks for the local Expect.dev pilot.

## 2. Local Expect.dev Pilot

- [x] 2.1 Add `scripts/expect-preflight.sh` using `expect-cli` `tui` with Codex, changed-git target, local dev-server URL, default no-cookie mode, output/timeout overrides, and opt-in noninteractive execution.
- [x] 2.2 Add `qa:expect` to `package.json` without adding Expect.dev to dependencies, lockfiles, CI workflows, or required verification gates.

## 3. Documentation

- [x] 3.1 Add `docs/testing/TESTING_STRATEGY.md` with the current testing workflow audit table, Lane 0 through Lane 5 methodology, production Supabase auth policy, optional Codex MCP config, validation evidence fields, speed triage, and Phase 2 recommendations.
- [x] 3.2 Update root `AGENTS.md` only for the local-only Expect.dev safety policy and its advisory relationship to `verify:change:run`.

## 4. Verification

- [x] 4.1 Reconfirm `expect-cli` version and `expect tui` flag support with `npx -y expect-cli@latest tui --help` and `npm view expect-cli version`.
- [x] 4.2 Run `pnpm run verify:change` and record the final required commands.
- [x] 4.3 Run `pnpm run qa:expect` against `http://localhost:3000`, starting `pnpm dev` first if needed, and document any package, app boot, auth, or agent limitation.
- [x] 4.4 Run required repo gates: `pnpm run spec:validate`, `pnpm run typecheck`, `pnpm run verify:app`, and `pnpm run verify:change:run`.
- [x] 4.5 Archive the completed OpenSpec change after required verification passes.
