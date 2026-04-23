# Verification Triage

Use this when a local verification command fails and you need the fastest next move instead of a broad rerun.

## Failure Classes

### Environment

Examples:

- occupied Supabase ports
- `[bootstrap]` failures
- local auth or storage bootstrap setup problems

First response:

1. stop the repo-local stack with `supabase stop`
2. rerun only the blocked command
3. return to `pnpm run verify:change:run` after the blocked command passes

### Test Gap

Examples:

- `pnpm run verify:test-delta` failures
- missing mapped repo-local test updates
- `No tests found` for a command that the current diff requires

First response:

1. add or update the smallest direct test that proves the touched behavior
2. rerun only the failing test-oriented command
3. return to `pnpm run verify:change:run` after the narrow command passes

### Contract / Harness

Examples:

- `[contract]` missing route registry entries, page markers, or smoke surface literals
- `[selector]` ambiguous Playwright selectors
- `[harness]` generic surface-open or ready-state failures

First response:

1. fix the route, surface, or selector contract at the component or page level
2. add or update the smallest direct test that locks the fix
3. rerun `pnpm run smoke:check` or `pnpm run test:ui:smoke:targeted`, whichever actually failed
4. return to `pnpm run verify:change:run`

### Product

Examples:

- `[product]` runtime regressions
- application build failures
- browser flows that fail even though contracts are present

First response:

1. add or update the smallest direct unit or component test that proves the bug
2. rerun the narrow failing command
3. return to `pnpm run verify:change:run`

## Default Rerun Rule

For repo verification work:

1. write down the failure class before any rerun: `environment`, `test gap`, `contract / harness`, or `product`
2. rerun only the narrow failing command for that class
3. return to `pnpm run verify:change:run` after the narrow command passes

## Full Smoke Rule

Do not run `pnpm run test:ui:smoke` manually before `pnpm run verify:change:run` unless:

- `pnpm run test:ui:smoke:targeted` already showed a browser-only failure that needs full-suite context
- or `pnpm run verify:change:run` failed and the next debugging step is specifically the full browser suite

Prefer direct tests, `pnpm run smoke:check`, and targeted smoke while coding.
