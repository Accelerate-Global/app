## Why

The Datasets Resources card still exposes only the country-code built-in
resource even though the ROP code resource is now available. The same card and
API-run resource model also continue to track resource categories that are not
needed for the current workflow.

## What Changes

- Add the ROP Codes built-in resource to the admin Datasets Resources card at
  `/dashboard/api-connections`, linking to `/dashboard/rop-codes`.
- Remove the Resources `Category` column from the Datasets Resources card.
- **BREAKING** Remove `category` tracking from persisted API connection
  resources, including the public TypeScript resource shape, extraction output,
  Drizzle schema, and Supabase migration state.
- Preserve Joshua Project output flattening and raw output behavior; this change
  only stops copying resource categories into `private.api_connection_resources`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `reference-resources`: The admin Datasets Resources card includes the ROP
  Codes built-in resource and no longer presents resource categories.
- `api-connection-runs`: Persisted API connection resources no longer store or
  expose category metadata.

## Impact

- Affects `src/components/dashboard/api-connections-client.tsx`,
  `src/lib/api-types.ts`, `src/lib/api-connections.ts`,
  `src/db/schema.ts`, and tests that assert resource rendering, extraction,
  listing, and schema shape.
- Affects Supabase schema through a migration that drops
  `private.api_connection_resources.category` while preserving the table,
  existing rows, RLS, indexes, and remaining columns.
- Affects the admin-only API Connections/Datasets UI and API resource type; it
  does not change auth, admin permissions, Vercel deployment behavior, or the
  existing `/dashboard/rop-codes` resource implementation.
- UI smoke coverage remains on the existing `/dashboard/api-connections` route;
  no new page route is added.
