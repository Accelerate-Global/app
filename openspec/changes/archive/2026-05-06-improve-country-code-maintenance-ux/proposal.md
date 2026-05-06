## Why

The country and territory code detail sheet still exposes developer-oriented copy
actions, alternate names cannot be removed, and alternate-name edits are lost on
reload. The account menu also exposes appearance choices as three separate rows,
and the new Resources page is not discoverable from the user menu for
non-admins.

## What Changes

- Persist admin-managed country-code alternate names in a private Supabase table
  and merge them into the generated resource for all signed-in users.
- Add an admin-only alternate-name API for durable add and delete behavior.
- Simplify the country-code detail sheet, remove copy controls, and clean up
  refresh completion feedback.
- Replace separate account-menu appearance rows with one compact System / Light
  / Dark segmented control.
- Add Resources to the account menu for every signed-in role.

## Capabilities

### Modified Capabilities
- `iso-country-code-resource`: durable alternate-name overrides, simplified
  detail sheet, and updated refresh completion feedback.
- `reference-resources`: account-menu discovery for signed-in users.
- `system-appearance`: one segmented account-menu appearance control.

## Impact

- Adds a private Supabase migration and Drizzle table.
- Affects `/dashboard/country-codes`, `/api/iso-country-codes/*`, the
  country-code client, account menu, theme UI, OpenSpec specs, and related
  tests.
- Row active/inactive edits remain session-only.
