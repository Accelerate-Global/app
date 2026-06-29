## MODIFIED Requirements

### Requirement: Production deploys from main
The system SHALL treat the Vercel production deployment path as a deployment
from the canonical GitHub source repository's `main` branch to the configured
production domain.

#### Scenario: Main branch deployment from canonical source
- **WHEN** a reviewed change is merged to `main` in `Accelerate-Global/app`
- **THEN** Vercel deploys the existing `online` project to production
- **AND** Release Health verifies the production alias using the current GitHub
  repository's deployment records

#### Scenario: Release Health verifies Supabase heartbeat route
- **WHEN** Release Health verifies the production alias after a `main`
  deployment
- **THEN** it checks `GET /api/ops/supabase-heartbeat` without credentials
- **AND** it treats HTTP 401 as the expected healthy protected state
- **AND** it fails when the route is missing, `CRON_SECRET` is missing, or
  Supabase is unavailable
