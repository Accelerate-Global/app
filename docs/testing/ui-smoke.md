# UI Smoke System

`@playwright/test` is the canonical browser smoke gate for this repo. The suite runs against the real local stack, not mocks:

1. `supabase start`
2. `supabase db reset`
3. `pnpm run smoke:preflight`
4. deterministic smoke bootstrap data and auth users
5. `pnpm build`
6. `pnpm start`
7. Playwright desktop and mobile sweeps in Chromium

Use `agent-browser` for ad hoc manual investigation, not as the default regression gate.

## Codex Desktop Note

In Codex desktop on macOS, Playwright Chromium launch fails inside the default sandbox with Mach port permission errors. For the commands below, request escalated execution immediately instead of trying the sandbox first:

- `pnpm run test:ui:smoke`
- `pnpm run test:ui:smoke:targeted`
- `pnpm run test:ui:smoke:headed`
- `pnpm run verify:change:run` when it will invoke UI smoke

Treat the initial sandbox attempt as wasted work. The first browser-smoke attempt should be outside the sandbox.

## Commands

Install the Chromium browser once on a machine:

```bash
pnpm exec playwright install chromium
```

Run the fast contract checker:

```bash
pnpm run smoke:check
```

Plan the current worktree and required verification commands:

```bash
pnpm run verify:change
```

Record the kickoff brief for an AI-agent task and classify unrelated dirty files:

```bash
pnpm run task:kickoff -- --scope src/app/dashboard/** --scope src/components/auth/**
```

Run the current-worktree verification bundle, including required test deltas and required commands:

```bash
pnpm run verify:change:run
```

Run the single pre-ship local gate:

```bash
pnpm run verify:ship:local
```

Run the local smoke environment preflight:

```bash
pnpm run smoke:preflight
```

Run the current-worktree targeted smoke subset:

```bash
pnpm run test:ui:smoke:targeted
```

Run the full smoke suite:

```bash
pnpm run test:ui:smoke
```

Run the full smoke suite headed:

```bash
pnpm run test:ui:smoke:headed
```

## What The Suite Covers

- anonymous auth entry routes
- viewer dashboard and dataset browsing routes
- admin dashboard, field definitions, field sources, profile, and upload routes
- route redirects such as `/sign-in` and `/dashboard/datasets`
- generic app surfaces exposed through the smoke DOM contract
- shared primitives rendered on `/__smoke/components`
- write journeys on disposable local data:
  - edit dataset details
  - edit field definition text
  - create a source column and update a field source value
- replace a seeded dataset through the real upload flow

## Stages And Failure Classes

Use the smoke pipeline in this order:

1. `pnpm run task:kickoff -- --scope <owned-path-or-glob>` when you want a task brief with unrelated dirty paths
2. `pnpm run verify:change`
3. direct tests plus `pnpm run smoke:check` while coding
4. `pnpm run test:ui:smoke:targeted` only when a browser-specific issue needs debugging
5. `pnpm run verify:change:run`
6. `pnpm run verify:ship:local`

Failure prefixes are intentional:

- `[contract]`: missing route registry entries, page markers, page-ready markers, or other static smoke contracts
- `[contract]`: also includes targeted smoke selections that match zero Playwright tests
- `[selector]`: strict-mode locator collisions or ambiguous selectors
- `[harness]`: generic smoke helpers could not open, ready, or close a contract surface
- `[bootstrap]`: local Supabase, auth, storage, or bootstrap preflight problems
- `[product]`: app behavior, build, or runtime regressions

## Active Pilot Window

The next 3 AI-agent UI and admin tasks are the rollout pilot for this workflow.

- Run `pnpm run task:kickoff -- --scope <owned-path-or-glob>` before editing so the task starts with an explicit ownership and verification brief.
- Use direct tests and `pnpm run smoke:check` while coding; keep `pnpm run test:ui:smoke:targeted` for browser-only debugging.
- Before rerunning a failed verification command, classify it as `environment`, `contract / harness`, or `product`.
- Rerun only the narrow failing command after classification, then return to `pnpm run verify:change:run`.
- Keep `pnpm run verify:change:run` as the single terminal gate for the current candidate tracked tree.

## Required Contracts

### Page Contract

Every `src/app/**/page.tsx` must have at least one explicit entry in `tests/ui/route-registry.ts`.

Rendered pages must expose:

```tsx
<main
  data-smoke-page="route-id"
  data-smoke-page-ready="route-id"
>
  ...
</main>
```

Redirect-only pages do not need `data-smoke-page`, but they still need a route registry entry with `redirectTo`.

Generic route sweeps assert only the page identity contract and the page-ready contract. They do not assert headings, copy, or incidental text.

### Surface Contract

Any app UI that opens a drawer, sheet, dialog, popover, menu, or tooltip that should be browser-smoked must expose matching literal identifiers:

```tsx
data-smoke-trigger="account-menu"
data-smoke-surface="account-menu"
data-smoke-ready="account-menu"
data-smoke-close="account-menu"
```

Notes:

- `data-smoke-close` is optional when `Escape` is a safe close path.
- `data-smoke-write="safe"` can be added to indicate the trigger is safe for generic opening during route sweeps.
- Use literal strings, not computed expressions, so `pnpm run smoke:check` can statically validate the contract.
- Prefer literal `data-smoke-*` selectors over `getByText()` and broad `getByLabel()` queries in repeated UI. If a journey needs a stable selector, add one.

### Shared UI Fixture Contract

Every file under `src/components/ui/*.tsx` must have a colocated `*.smoke.tsx` fixture module.

Each fixture must default-export a `UiSmokeFixture` via `defineUiSmokeFixture(...)`.

Example:

```tsx
export default defineUiSmokeFixture({
  id: "button",
  title: "Button",
  Component: ButtonSmokeFixture,
});
```

The hidden route `/__smoke/components` is implemented in `src/app/%5F_smoke/components/page.tsx` and renders the generated fixture manifest from `src/components/ui/smoke-fixtures.generated.ts`.

The fixture route verifies shared primitive render coverage only. Generic surface crawling still happens on real app routes, where menus, sheets, popovers, tooltips, and dialogs are exercised in product context.

Do not hand-edit that manifest. Run:

```bash
pnpm run smoke:check
```

That script regenerates the manifest and fails if a shared primitive is missing its fixture.

## Deterministic Smoke Data

`pnpm run smoke:bootstrap` creates:

- one admin user
- one viewer user
- allowlist rows for both emails
- seeded datasets and rows
- filter regions
- field definitions
- field source types and values

Bootstrap metadata is written to `.tmp/ui-smoke/bootstrap.json` and consumed by the Playwright route registry and journey specs.

## Adding New UI Without Breaking CI

Treat the following as blocking, not informational:

- if directly tested repo code changes, the diff must include a matching direct test delta
- every command listed under `pnpm run verify:change` “Required commands” must pass locally
- `No tests found`, skipped checks, and repo-owned verification tool failures must be fixed before finalizing

When you add a new route:

1. add `data-smoke-page="..."` and `data-smoke-page-ready="..."` to the rendered page root
2. add an entry to `tests/ui/route-registry.ts`
3. if the route needs deterministic data, extend `scripts/smoke-bootstrap.ts`
4. run `pnpm run verify:change`
5. run `pnpm run verify:change:run`

When you add a new sheet, dialog, popover, menu, or tooltip:

1. add the `data-smoke-trigger` / `data-smoke-surface` / `data-smoke-ready` contract
2. add `data-smoke-close` if Escape is not the intended close path
3. run `pnpm run verify:change`
4. run `pnpm run verify:change:run`
5. extend or add a Playwright journey only when the generic route sweep is not enough
6. if the surface sits in repeated UI, add a stable literal `data-smoke-*` selector for the journey before relying on text

When you add a new shared primitive under `src/components/ui`:

1. create `src/components/ui/<name>.smoke.tsx`
2. keep the fixture deterministic and free of app data dependencies
3. run `pnpm run verify:change`
4. run `pnpm run verify:change:run`

## Verification Intent

At the start of any UI, DB, or migration task, write a short verification intent before coding:

- changed area
- required commands from `pnpm run verify:change`
- targeted smoke subset from `pnpm run verify:change`

For AI-agent work, prefer the thin-slice loop:

1. run `pnpm run task:kickoff -- --scope <owned-path-or-glob>`
2. implement the smallest slice that can be checked locally
3. run direct tests for touched code and `pnpm run smoke:check` when UI contracts changed
4. use `pnpm run test:ui:smoke:targeted` only for browser-specific debugging
5. use `pnpm run verify:change:run` as the single terminal gate for the candidate tracked tree

Use `pnpm run verify:ship:local` as the final local merge or release gate. It reuses prior local receipts on the same tracked tree and, when both targeted and full browser smoke are still needed, runs them against one Supabase/bootstrap/build session. Do not finalize work if `verify:change` reports missing required test updates or if targeted smoke cannot select any real Playwright tests.

Do not run `pnpm run test:ui:smoke` manually before `pnpm run verify:change:run` unless you are isolating a browser-specific failure after targeted smoke or the terminal gate fails. Use [/Users/blake/Documents/accelerate-global/online/docs/testing/verification-triage.md](/Users/blake/Documents/accelerate-global/online/docs/testing/verification-triage.md) for first-response steps by failure class.

## CI

`.github/workflows/ui-smoke.yml` is the PR gate for this system.

The workflow now uses the same diff planner as local verification:

- when the diff does not require UI smoke, the workflow reports a skip
- when the diff maps to a targeted subset, it runs `pnpm run test:ui:smoke:targeted` against the PR base/head diff
- when the smoke harness changes, it runs the full suite
- when targeted diff selection matches no browser routes, the command still runs `pnpm run smoke:check` so contract validation stays blocking without paying for a no-op browser boot
