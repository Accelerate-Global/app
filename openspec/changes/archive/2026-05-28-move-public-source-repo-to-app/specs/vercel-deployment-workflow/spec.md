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

## ADDED Requirements

### Requirement: Canonical public source repository
The system SHALL treat `Accelerate-Global/app` as the canonical public source
repository and SHALL keep `Accelerate-Global/online` out of the supported public
release path.

#### Scenario: Public source migration
- **WHEN** the repository move is complete
- **THEN** the current Git remote, Vercel Git integration, and release
  documentation identify `Accelerate-Global/app` as the source repository
- **AND** `Accelerate-Global/online` remains private historical archive state
