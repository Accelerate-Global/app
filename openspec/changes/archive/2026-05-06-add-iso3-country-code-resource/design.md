## Context

The app currently exposes dataset and admin reference surfaces under
`src/app/dashboard/**` and tracks each page in `tests/ui/route-registry.ts`.
Existing CSV field metadata already references ISO3 country codes, but the app
does not expose a country-code reference resource. ISO documents that ISO 3166
codes are available through the Online Browsing Platform and that the Country
Codes Collection can be previewed there.

## Goals / Non-Goals

**Goals:**

- Provide a generated app resource containing current officially assigned ISO
  3166-1 alpha-2, alpha-3, numeric, and English short-name values.
- Provide a deterministic local refresh script that scrapes ISO's official OBP
  country-code grid and rewrites the generated resource.
- Provide an authenticated dashboard page that renders the checked-in resource
  quickly and lets the user search, copy, download, and refresh the list from
  the same official source on demand.
- Keep UI smoke and direct tests aligned with the new route and components.

**Non-Goals:**

- Do not add or change Supabase tables, migrations, RLS, or local database
  requirements.
- Do not change dataset import behavior, field-source mappings, or API
  connection run behavior.
- Do not persist live UI refresh results back to source files in production.

## Decisions

- Use ISO OBP Vaadin UIDL responses as the scrape source. The ISO marketing page
  and product page are stable, but the actual country-code grid is rendered by a
  Vaadin application. Initializing the OBP session and reading the grid's
  `DataCommunicatorClientRpc` payload keeps the scrape official while avoiding
  browser automation in the refresh command. Alternative considered: parse a
  third-party ISO list. That would be simpler but would not satisfy the official
  source requirement.
- Store the resource as generated JSON in the repo and expose typed helpers from
  app code. This makes normal page loads deterministic and reviewable, while
  still allowing manual refreshes. Alternative considered: fetch from ISO on
  every page request. That would couple user navigation to ISO availability and
  Cloudflare/session behavior.
- Add an authenticated GET endpoint for live refresh previews. The endpoint
  returns a freshly scraped list to the browser but does not mutate server state,
  so it avoids deployment-time filesystem writes and keeps same-origin mutation
  policy unchanged. Alternative considered: add an admin-only POST that rewrites
  the JSON file. That would not work reliably on Vercel and would add mutation
  risk for little benefit.
- Keep access authenticated rather than admin-only. Country codes are reference
  data used by dataset viewers, and the page does not expose secrets or mutate
  workspace state. Alternative considered: admin-only placement with other
  configuration resources, but that would hide a useful read-only lookup from
  non-admin users.

## Risks / Trade-offs

- ISO OBP protocol changes -> The refresh script and live endpoint validate row
  shape, minimum row count, duplicate alpha codes, and source metadata so
  protocol drift fails loudly instead of silently publishing a partial list.
- ISO blocks automated requests -> The checked-in snapshot continues to serve
  the UI, and refresh failures are shown as non-destructive UI errors.
- Copyright/licensing ambiguity -> The page includes ISO attribution and source
  links, and stores only code-list fields that ISO says may be used
  free-of-charge. It does not copy paid collection files.
- Non-ASCII country names -> The generated JSON remains UTF-8 because official
  English short names include entries such as Åland Islands.

## Migration Plan

- Add the OpenSpec capability, generated resource, scraper helper, refresh
  script, authenticated refresh endpoint, dashboard page, and tests.
- Run the refresh script once during implementation to generate the initial
  snapshot.
- Rollback by removing the route, generated resource, script, endpoint, route
  registry entries, and OpenSpec change.
