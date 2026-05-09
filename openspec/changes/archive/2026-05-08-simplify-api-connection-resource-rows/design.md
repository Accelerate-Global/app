## Context

`src/components/dashboard/api-connections-client.tsx` renders the admin API Connections page with a Resources card below the Connections table. That card currently uses a two-column table with `Display text` and `URL` headers for both built-in resources and persisted API-run resources. The resource URL is still required as navigation/opening data, but the user-facing card should no longer expose it as visible table content.

## Goals / Non-Goals

**Goals:**

- Make the `/dashboard/api-connections` Resources card render label-only resource rows with no visible table headers.
- Preserve built-in resource in-app navigation and captured resource external-tab opening.
- Keep keyboard activation through Enter and Space.
- Update the touched OpenSpec requirements and component tests to match the visible UI contract.

**Non-Goals:**

- No changes to resource persistence, extraction, API types, Supabase schema, migrations, RLS, auth metadata, Vercel runtime behavior, or UI smoke route registration.
- No changes to the standalone `/dashboard/resources` page.

## Decisions

- Keep the existing `Table` structure, but remove `TableHeader` from the Resources card and render one `TableCell` per row. This preserves existing row styling and accessibility hooks while removing visible columns.
- Use `resource.webText || "Captured resource"` for captured rows. This avoids leaking URLs when an API-run resource has no display text.
- Keep `resourceUrl` in the row event handlers only. Built-in rows continue to call `router.push`, and captured rows continue to call `window.open`.

## Risks / Trade-offs

- Label-only captured rows may be less specific when upstream data omits web text. The fallback label avoids showing raw URLs and keeps the card aligned with the requested simplified presentation.
- Removing visible headers means the Resources card is no longer a data-grid style presentation. This is intentional because the visible content is now a compact list of resource labels.
