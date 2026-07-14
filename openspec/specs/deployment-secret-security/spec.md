# deployment-secret-security Specification

## Purpose
Define storage and exposure constraints for high-impact production credentials
managed through Vercel so their values remain server-only and non-readable after
creation.

## Requirements
### Requirement: High-impact production credentials are non-readable after creation
The production database credential and Supabase server credential MUST use Vercel Sensitive environment-variable storage and MUST remain server-only.

#### Scenario: Collaborator inspects production variables
- **WHEN** an authorized Vercel collaborator lists or views production environment variables
- **THEN** the database and Supabase server credential values are not readable

#### Scenario: Browser bundle is built
- **WHEN** the application builds for production
- **THEN** neither credential is included in a `NEXT_PUBLIC_` variable or browser bundle
