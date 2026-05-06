## Why

The country and territory code resource is meant for non-technical signed-in
users, but its controls still read like developer tooling and the built-in
resource is only surfaced directly from admin-adjacent areas. Admin refresh also
needs visible progress and a stricter permission boundary.

## What Changes

- Add an authenticated `/dashboard/resources` page for built-in reference
  resources, starting with the country and territory code resource.
- Update the dashboard Reference Resources card to open the new Resources page.
- Keep `/dashboard/country-codes` available to all signed-in roles while making
  refresh admin-only and download available to every signed-in user.
- Replace the country-code JSON download button with a non-technical Download
  action that exports the current visible rows as CSV.
- Add upload-style staged refresh progress and align search, visible count,
  refresh, and download controls in one responsive row.

## Capabilities

### New Capabilities
- `reference-resources`: authenticated built-in reference resource discovery.

### Modified Capabilities
- `iso-country-code-resource`: changes refresh permissions, download format,
  resource discovery location, and country-code page controls.

## Impact

- Affects `/dashboard/resources`, `/dashboard/country-codes`, the dashboard
  resources card, and `tests/ui/route-registry.ts`.
- Affects `/api/iso-country-codes/refresh` by changing authenticated non-admin
  refresh from allowed to `403 Forbidden`.
- Affects UI smoke coverage because a new page route is added.
- No Supabase schema, RLS, Storage, Vercel deployment, or generated resource
  schema changes are intended.
