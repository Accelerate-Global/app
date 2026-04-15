# UI Smoke System

`@playwright/test` is the canonical browser smoke gate for this repo. The suite runs against the real local stack, not mocks:

1. `supabase start`
2. `supabase db reset`
3. deterministic smoke bootstrap data and auth users
4. `pnpm build`
5. `pnpm start`
6. Playwright desktop and mobile sweeps in Chromium

Use `agent-browser` for ad hoc manual investigation, not as the default regression gate.

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
- admin dashboard, field definitions, field sources, filter settings, profile, and upload routes
- route redirects such as `/sign-in` and `/dashboard/datasets`
- generic app surfaces exposed through the smoke DOM contract
- shared primitives rendered on `/__smoke/components`
- write journeys on disposable local data:
  - edit dataset details
  - edit field definition text
  - create and update a filter region
  - create a source column and update a field source value
  - replace a seeded dataset through the real upload flow

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

The hidden route `/__smoke/components` renders the generated fixture manifest from `src/components/ui/smoke-fixtures.generated.ts`.

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

When you add a new route:

1. add `data-smoke-page="..."` and `data-smoke-page-ready="..."` to the rendered page root
2. add an entry to `tests/ui/route-registry.ts`
3. if the route needs deterministic data, extend `scripts/smoke-bootstrap.ts`
4. run `pnpm run verify:change`
5. run `pnpm run smoke:check`

When you add a new sheet, dialog, popover, menu, or tooltip:

1. add the `data-smoke-trigger` / `data-smoke-surface` / `data-smoke-ready` contract
2. add `data-smoke-close` if Escape is not the intended close path
3. run `pnpm run verify:change`
4. extend or add a Playwright journey only when the generic route sweep is not enough

When you add a new shared primitive under `src/components/ui`:

1. create `src/components/ui/<name>.smoke.tsx`
2. keep the fixture deterministic and free of app data dependencies
3. run `pnpm run verify:change`
4. run `pnpm run smoke:check` to regenerate the fixture manifest

## CI

`.github/workflows/ui-smoke.yml` is the PR gate for this system.

It installs dependencies, installs Chromium, starts local Supabase, bootstraps smoke data, builds the app, and runs the Playwright suite.
