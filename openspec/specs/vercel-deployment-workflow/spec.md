# vercel-deployment-workflow Specification

## Purpose
Define the supported Vercel deployment workflow for this repo, including
production deployments from `main` and the absence of a staging promotion path.
## Requirements
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

### Requirement: No staging deployment path
The system SHALL NOT maintain a supported Vercel `staging` custom environment or staging promotion path for this repo.

#### Scenario: Staging environment removed
- **WHEN** the Vercel project configuration is inspected
- **THEN** no custom environment with the slug `staging` exists for the `online` project

### Requirement: Preview branch does not deploy as staging
The system SHALL allow automatic Vercel builds only for the production branch used by this repo.

#### Scenario: Non-main branch push
- **WHEN** a branch other than `main` is pushed
- **THEN** the Vercel ignored-build-step policy prevents that branch from becoming a standing staging deployment

### Requirement: Canonical public source repository
The system SHALL treat `Accelerate-Global/app` as the canonical public source
repository and SHALL keep `Accelerate-Global/online` out of the supported public
release path.

#### Scenario: Public source migration
- **WHEN** the repository move is complete
- **THEN** the current Git remote, Vercel Git integration, and release
  documentation identify `Accelerate-Global/app` as the source repository
- **AND** `Accelerate-Global/online` remains private historical archive state

### Requirement: Production deployment schedules Supabase heartbeat
The system SHALL configure the Vercel production deployment to invoke the
Supabase heartbeat endpoint once per day using Vercel Cron.

#### Scenario: Production cron configuration is deployed
- **WHEN** the Vercel project deploys the tracked production configuration
- **THEN** Vercel has a cron job for `/api/ops/supabase-heartbeat`
- **AND** the schedule runs no more frequently than once per day

#### Scenario: Cron invokes heartbeat with Vercel secret
- **WHEN** Vercel invokes the configured heartbeat cron job
- **THEN** the request includes the `Authorization` bearer value derived from
  the project's `CRON_SECRET` environment variable
- **AND** the heartbeat route uses that value to authenticate the request

