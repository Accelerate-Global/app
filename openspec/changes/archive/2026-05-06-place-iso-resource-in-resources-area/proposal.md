## Why

The ISO3 country-code lookup is implemented, but users looking at the API
Connections page expect reference resources to appear in the Resources card
shown below the connections list. The new lookup should be discoverable from
that existing resource area instead of only from the main dashboard.

## What Changes

- Add the ISO3 country-code lookup as a built-in row in the API Connections
  Resources section.
- Preserve the captured API-run resources table behavior.
- Update direct component tests for the Resources card.
- Non-goals: do not change the ISO scrape/refresh behavior, generated country
  code data, route access rules, Supabase schema/RLS, or API connection run
  lifecycle.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `iso-country-code-resource`: The ISO3 resource must be discoverable from the
  API Connections Resources area.

## Impact

- Affects the API Connections dashboard client UI under
  `src/components/dashboard/api-connections-client.tsx`.
- Affects the existing ISO country-code resource specification.
- Does not affect auth role definitions, admin permission semantics, Supabase,
  Vercel configuration, or API contracts.
