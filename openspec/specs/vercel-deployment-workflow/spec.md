# vercel-deployment-workflow Specification

## Purpose
Define the supported Vercel deployment workflow for this repo, including
production deployments from `main` and the absence of a staging promotion path.
## Requirements
### Requirement: Production deploys from main
The system SHALL treat the Vercel production deployment path as a deployment from the GitHub `main` branch to the configured production domain.

#### Scenario: Main branch deployment
- **WHEN** a reviewed change is merged to `main`
- **THEN** Vercel deploys the project to production and Release Health verifies the production alias

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
