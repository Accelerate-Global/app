## Context

The generated country-code resource remains the source of row identity and code
metadata. Admin edits need to override only alternate names, and the override
state must be shared across users without exposing write access to browser
roles.

## Decisions

- Store overrides in `private.iso_country_code_entry_overrides`, keyed by
  `display_name`, because the curated overlay defines the row universe.
- Keep the table private with RLS enabled and no `anon` or `authenticated`
  grants. Next.js API handlers enforce workspace-role permissions before
  writing through the server database connection.
- Merge overrides over the generated resource at page-load and after a live
  refresh, so every signed-in user sees shared aliases.
- Persist both add and delete via the same admin-only `PATCH` endpoint that
  receives the complete alternate-name array for a display name.
- Keep row status edits session-only to avoid broadening this change into
  general country-code row mutation.
- Use one segmented account-menu appearance control while preserving the
  existing `system`, `light`, and `dark` preference values and analytics event.

## Risks / Trade-offs

- Display-name keys assume curated row names are stable. If a future generated
  resource renames a row, the old override no longer applies rather than
  mutating the wrong row.
- The refresh progress remains approximate; on success the panel disappears and
  the button checkmark confirms completion.
