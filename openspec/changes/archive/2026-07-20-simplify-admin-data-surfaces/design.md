## Context

The admin account menu currently exposes standalone Field Sources and Analytics
pages. Field-source relationships are already presented in Definitions, while
the analytics page exposes an internal operational event store that is not the
authentication-usage question administrators are trying to answer. Connections
also presents built-in and captured resources as a visually inconsistent list
without freshness or size context.

The existing data boundaries are useful and should remain intact: Definitions
depends on the field-source registry, operational analytics events remain useful
for application diagnostics, and Supabase Auth already stores the most recent
successful sign-in timestamp. The change therefore simplifies presentation and
navigation without deleting persistent data or introducing a new tracking
system.

## Goals / Non-Goals

**Goals:**

- Remove redundant Field Sources and Analytics destinations from the admin
  navigation while preserving compatible redirects for saved URLs.
- Preserve field-source mappings for Definitions and preserve internal
  operational analytics persistence.
- Show the most defensible authentication-recency value in User Management.
- Present connection resources with the same table language as Dataset sources
  and expose useful size and freshness metadata.
- Remove now-unreachable page-specific APIs and controls.

**Non-Goals:**

- Deleting field-source seed data, analytics history, or analytics event
  instrumentation.
- Re-enabling or changing Vercel Web Analytics.
- Inferring page activity, session duration, visit frequency, or other behavior
  from a successful-authentication timestamp.
- Adding a Supabase schema migration or changing workspace permissions.

## Decisions

### Retired routes redirect to their clearer destinations

`/dashboard/field-sources` redirects to `/dashboard/field-definitions`, and
`/dashboard/analytics` redirects to `/dashboard/user-management`. Their account
menu entries are removed. Redirects preserve old bookmarks and make the product
decision explicit without maintaining duplicate screens.

The Field Sources read API and analytics failure-triage mutation API are removed
because no supported product surface consumes them after the redirects. The
underlying field-source registry and internal analytics storage remain.

### Authentication recency is labeled Last sign-in

User Management displays `auth.users.last_sign_in_at`, already mapped as
`lastLoginAt` by the server-side user-management loader. The column is labeled
`Last sign-in`, and a missing timestamp is shown as `Never`. This is more precise
than `Last activity`: it represents a successful authentication, not subsequent
use of the application. No additional tracking or elevated client access is
introduced.

### Resource rows use catalog and capture metadata already available to the page

The Resources card uses a table with `Source`, `Entries`, and `Last updated`.
Built-in resources show the active catalog version's entry count and source
retrieval timestamp. Captured resources show an unavailable entry count and the
capture timestamp. Built-in rows remain direct navigation targets; captured rows
remain informational because their stored URL is provenance data, not a new
product navigation contract.

### Vercel Analytics remains paused independently of this UI removal

The project may retain a Vercel Web Analytics resource identifier, but the app
does not mount the Vercel collector and its CSP does not permit that collector.
Removing the internal Analytics dashboard does not change Vercel project
settings and does not stop app-owned operational event persistence.

## Risks / Trade-offs

- Removing the triage UI means historical internal failures are no longer
  classified from the product. This is intentional: the surface is unused and
  not the desired admin metric. The historical data remains available for a
  future purpose-built diagnostic workflow.
- `last_sign_in_at` does not prove ongoing activity or frequency. Precise naming
  and the `Never` state prevent administrators from over-interpreting it.
- Captured resources do not have a normalized entry count. Showing an em dash is
  preferable to deriving a misleading count from unrelated run data.
- Redirect pages remain in the route tree, so route-registry coverage must model
  them as redirects rather than rendered smoke pages.

## Migration Plan

1. Add redirect behavior and remove retired navigation entries.
2. Remove the two unsupported APIs and page-specific UI controls.
3. Add Last sign-in to User Management and rebuild the Resources card.
4. Update route coverage, focused tests, documentation, and smoke selection.
5. Run the repository verification gate, sync the accepted delta specs, and
   archive the change.

Rollback restores the page components, APIs, menu links, and prior Resources
list. No persistent-data rollback is required because the change has no schema
or destructive data operation.

## Open Questions

None. Broader activity and frequency metrics are intentionally deferred until a
specific decision can justify new tracking semantics and privacy trade-offs.
