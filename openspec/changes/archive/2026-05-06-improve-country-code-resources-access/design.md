## Context

`/dashboard/country-codes` already redirects anonymous users and renders the
generated country and territory resource for signed-in users. The dashboard has
a Reference Resources card, and `/dashboard/api-connections` currently includes
an admin-only Resources section that also lists captured API-run URLs.

## Goals / Non-Goals

**Goals:**
- Provide a non-admin-facing `/dashboard/resources` page for built-in resources.
- Keep captured API-run resources admin-only.
- Restrict live country-code refresh to dataset admins.
- Make the country-code download button non-technical and export CSV.
- Show staged refresh progress without introducing streaming or polling.

**Non-Goals:**
- No database migrations or new persisted resource tables.
- No changes to ISO, GENC, FIPS scraping or generated JSON resource shape.
- No exposure of captured API-run resources to non-admin users.
- No changes to API Connections run permissions.

## Decisions

- Create a simple server-rendered Resources page under `src/app/dashboard` so it
  follows existing dashboard auth, header, and smoke-marker conventions.
- Keep the built-in resource list local to the resources UI for this change. A
  shared registry can be added later if more built-ins need cross-page reuse.
- Pass `canRefresh` from the country-code page into the client rather than
  deriving role state in the browser.
- Use the existing `Progress` primitive and staged client messages for refresh
  progress. The refresh endpoint remains a single request because source-level
  streaming is not required.
- Export CSV from the client using the filtered `visibleEntries`, with explicit
  escaping and user-facing columns.

## Risks / Trade-offs

- Staged refresh progress is approximate because the current refresh endpoint
  returns only after all upstream sources complete. This is acceptable for the
  requested upload-style feedback and avoids a larger API redesign.
- Built-in resources remain duplicated between API Connections and the new
  Resources page for now. This keeps the change scoped and avoids opening
  admin-only captured resources to non-admins.
