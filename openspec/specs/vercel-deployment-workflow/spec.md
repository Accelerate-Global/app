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

