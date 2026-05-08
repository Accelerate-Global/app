## Context

The admin `/dashboard/api-connections` page is titled `Datasets` and renders
the Resources card through `ApiConnectionsClient`. That card currently has one
component-local built-in resource for `/dashboard/country-codes`, then appends
the newest persisted API-run resources from `private.api_connection_resources`.
The standalone authenticated Resources page already includes the ROP Codes
resource, and `/dashboard/rop-codes` is already implemented and smoke-registered.

Persisted API-run resources currently include a `category` column, TypeScript
field, extraction merge path, and UI column. The approved product direction is
to stop tracking that metadata rather than only hiding it.

## Goals / Non-Goals

**Goals:**

- Add the ROP Codes resource to the Datasets Resources card.
- Remove category display and persistence for API connection resources.
- Keep existing resource URL dedupe, display text, source row/index metadata,
  RLS posture, and admin-only page access.
- Preserve Joshua Project parsed output columns, including
  `Resource_##_Category`, as normal run output data.

**Non-Goals:**

- Do not change `/dashboard/resources` or `/dashboard/rop-codes` behavior.
- Do not change API connection permissions, run lifecycle, import behavior, or
  provider request semantics.
- Do not reset local or remote Supabase data beyond dropping the unused column.

## Decisions

- Use the existing component-local built-in resource list for the Datasets card.
  This keeps the change scoped to the admin page and avoids creating a second
  shared resource registry before one is needed.
- Remove `category` from the persisted resource contract end to end. Hiding only
  the column would leave unused data flow and schema surface behind, contrary to
  the requirement not to track it.
- Leave Joshua Project row flattening unchanged. `Resource_##_Category` remains
  part of downloadable/importable run output; the removed behavior is only the
  separate durable resource index metadata.
- Commit a forward SQL migration that drops
  `private.api_connection_resources.category`. Rollback is to re-add the column
  with `text not null default ''`; historical category values are intentionally
  not preserved because the field is no longer needed.

## Risks / Trade-offs

- Existing deployed code reading `category` would fail after the migration if
  code and migration are not deployed together. Mitigation: update code, schema,
  tests, and migration in one tracked change.
- Dropping the column discards previous category metadata. Mitigation: this is
  the requested behavior, and resource URL/display text/source metadata remain.
- Local Supabase verification may require starting or resetting the repo-local
  stack if migration/security checks are selected by `verify:change`. Mitigation:
  use repo cleanup rules and stop services before finalizing if started.
