## Why

Dataset work already depends on ISO3 country codes, but users do not have a
first-class place in the web UI to inspect the current official country-name to
ISO 3166-1 alpha-3 mapping or refresh it from ISO when needed. A refreshable
resource reduces manual lookup drift and makes the source of country-code data
visible inside the app.

## What Changes

- Add an app resource for ISO 3166-1 country names and alpha-3 codes sourced
  from the official ISO website.
- Add a refresh path that can re-scrape the official ISO source on demand and
  update the generated resource list.
- Add an interactive dashboard page where authenticated users can search,
  filter, copy, and inspect the current ISO3 mapping and source metadata.
- Add tests and UI smoke coverage for the new dashboard route.
- Non-goals: do not change dataset import semantics, field definition behavior,
  Supabase schema/RLS, or existing API connection run behavior.

## Capabilities

### New Capabilities

- `iso-country-code-resource`: Defines the official-source ISO3 country code
  resource, refresh behavior, permissions, metadata, and interactive UI.

### Modified Capabilities

- None.

## Impact

- Affects UI smoke coverage because a new `src/app/**/page.tsx` route must be
  registered in `tests/ui/route-registry.ts` and expose `data-smoke-page`
  markers per `docs/testing/ui-smoke.md`.
- Affects data integrity at the app-resource level by introducing a generated
  checked-in resource and a deterministic refresh script.
- Affects API contracts only if an internal dashboard refresh/read endpoint is
  added; any mutation remains protected by the existing same-origin guard in
  `src/proxy.ts` and `src/lib/request-security.ts`.
- Does not affect auth role definitions, admin permission semantics, Supabase
  schema/RLS, or Vercel deployment configuration.
- Brownfield assumptions are grounded in existing dashboard routes under
  `src/app/dashboard/**`, route smoke policy in `tests/ui/route-registry.ts`,
  and country-code field usage in `src/data/field-sources/field-description-seed.csv`.
