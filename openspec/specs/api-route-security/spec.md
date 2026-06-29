# api-route-security Specification

## Purpose
Define the shared security behavior for protected Next.js API routes so identity
resolution, admin authorization, route-handler error normalization, and
documented anonymous exemptions stay consistent across route implementations.
## Requirements
### Requirement: Protected API routes use centralized route security
The system SHALL apply authenticated user access, admin-only authorization, and
unexpected-error normalization through one centralized API route guard for
protected application API handlers.

#### Scenario: Anonymous request calls a protected API route
- **WHEN** an unauthenticated request calls a protected API route
- **THEN** the system returns `401 Unauthorized` with a JSON error response
- **AND** the protected route handler is not invoked

#### Scenario: Non-admin request calls an admin API route
- **WHEN** an authenticated non-admin user calls an admin-only API route
- **THEN** the system returns `403 Forbidden` with the route's admin-only action message
- **AND** the protected route handler is not invoked

#### Scenario: Authenticated request calls an allowed API route
- **WHEN** an authenticated user satisfies the route's access requirement
- **THEN** the system invokes the route handler with the resolved identity and original route arguments

#### Scenario: Identity resolution fails unexpectedly
- **WHEN** resolving the current identity throws an unexpected error for a protected API route
- **THEN** the system logs a normalized API route error
- **AND** the system returns `500 Internal Server Error` with a JSON error response

#### Scenario: Protected route handler fails unexpectedly
- **WHEN** a protected route handler throws an unexpected error
- **THEN** the system logs a normalized API route error
- **AND** the system returns `500 Internal Server Error` with a JSON error response

### Requirement: API route guard exemptions are explicit
The system MUST keep API routes that do not use the centralized route guard in
an explicit documented exemption list with a route-specific reason.

#### Scenario: Anonymous analytics route is inspected
- **WHEN** route security coverage is checked for the anonymous analytics event route
- **THEN** the route is allowed to manage identity conditionally because it accepts anonymous analytics events

#### Scenario: Google OAuth callback route is inspected
- **WHEN** route security coverage is checked for the Google Sheets OAuth callback route
- **THEN** the route is allowed to manage identity directly because browser-facing auth failures must redirect instead of returning JSON `401` responses

#### Scenario: Supabase heartbeat route is inspected
- **WHEN** route security coverage is checked for the Supabase heartbeat route
- **THEN** the route is allowed to use Vercel cron bearer authentication because it is not a user-session route

#### Scenario: New protected API route is added
- **WHEN** a protected API route is added without the centralized route guard
- **THEN** route security coverage fails unless the route is added to the documented exemption list with a reason
