## Context

`src/components/dashboard/iso-country-codes-client.tsx` currently renders the
country and territory resource as a wide table with every code, alias,
classification, and copy action visible. Other dashboard flows already use
`src/components/ui/sheet.tsx` for right-side detail interactions, including
dataset assignment and saved-table details.

## Goals / Non-Goals

**Goals:**
- Keep the resource searchable across all hidden and visible fields.
- Reduce the main table to scan columns while exposing full row details in a
  right-side sheet.
- Support active/inactive and alias changes in the current browser session.
- Keep refresh and JSON download behavior compatible with the current route
  and API.

**Non-Goals:**
- No Supabase persistence, migrations, RLS changes, or new API contracts.
- No changes to ISO, GENC, FIPS scraping or generated resource shape.
- No Vercel runtime or deployment behavior changes.

## Decisions

- Reuse the existing `Sheet` primitive rather than adding a new drawer
  dependency. This preserves the dashboard interaction pattern and existing
  smoke conventions.
- Store status and alias edits in the client-side resource state. The country
  resource is a generated static reference; introducing persistence would be a
  separate data model decision and is not needed for the requested table
  interaction update.
- Keep copy actions inside the detail sheet. The main table remains compact,
  while the existing primary alpha-3 and FIPS copy semantics stay available
  after selecting a row.
- Add `data-smoke-trigger`, `data-smoke-surface`, and `data-smoke-ready`
  markers for the country-code detail sheet so the registered page can be
  covered by the existing UI smoke system.

## Risks / Trade-offs

- Session-only edits reset on refresh or navigation. This is mitigated by
  keeping the implementation scoped to the existing generated-resource model
  and avoiding hidden database writes.
- More details are one click away instead of always visible. This is mitigated
  by preserving full-field search and showing primary scan codes in the table.
