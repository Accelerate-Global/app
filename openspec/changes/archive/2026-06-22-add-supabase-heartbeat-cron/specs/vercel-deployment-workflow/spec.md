## ADDED Requirements

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
