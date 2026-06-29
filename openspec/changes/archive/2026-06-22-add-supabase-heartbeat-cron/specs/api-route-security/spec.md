## MODIFIED Requirements

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
