## Context

Current-tree remediation is easy to regress because tests and docs often need
email-shaped values. The repo should default to neutral examples so the current
tree remains safe if GitHub visibility changes later.

## Approach

- Add a Vitest file under `scripts/` so the guard runs inside `pnpm run test`
  and the existing `verify:app` gate.
- Scan only `git ls-files` paths so ignored local `.env`, Vercel, Supabase temp,
  and audit artifacts are not read.
- Keep the denylist narrow to the real identifiers removed by the audit, plus
  named bootstrap prose that would reintroduce the same issue.

## Verification

- Run the new test directly.
- Run `pnpm run spec:validate`, `pnpm run verify:change`, and
  `pnpm run verify:change:run`.
