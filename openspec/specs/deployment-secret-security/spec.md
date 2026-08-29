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

### Requirement: Operational email credentials remain server-only
Operational Resend credentials, dispatch credentials, sender configuration, and developer recipients MUST remain server-only in the runtime that uses them.

#### Scenario: Supabase sends a primary operational alert
- **WHEN** the operational Edge Function calls Resend
- **THEN** its Resend API key and dispatch secret come from Supabase Edge Function secrets
- **AND** database dispatch uses only a matching secret stored in Supabase Vault

#### Scenario: Vercel sends a Supabase-outage fallback
- **WHEN** the heartbeat calls Resend directly
- **THEN** the Resend API key, sender, recipient, and details URL come from non-public Vercel environment variables

#### Scenario: Repository or browser is inspected
- **WHEN** a collaborator inspects committed files or a user loads the browser bundle
- **THEN** no operational Resend API key, dispatch secret, or developer recipient value is present

### Requirement: Samson backup credentials remain isolated and server-only
Database backup credentials, Storage reader credentials, receipt-signing keys, Restic repository credentials, recovery material, and direct backup-alert email credentials MUST remain outside Git, browser bundles, Supabase catalog rows, Vercel-readable payloads, and ordinary Proxmox host configuration.

#### Scenario: Backup guest is provisioned
- **WHEN** the Samson backup service receives its runtime credentials
- **THEN** they are stored in root-only secret files or an equivalent protected service credential store inside the isolated guest
- **AND** no secret value is written to repository files, manifests, logs, alerts, or archive catalog rows

#### Scenario: Backup uses Storage access
- **WHEN** the service reads private Supabase Storage objects
- **THEN** it uses an RLS-scoped read-only session when supported
- **AND** a full-access S3 key is not accepted as the default steady-state credential

#### Scenario: Complete dump requires a privileged fallback
- **WHEN** a read-only database role cannot produce the required complete and restorable backup
- **THEN** implementation stops for explicit security review before storing a privileged database credential on Samson
- **AND** the fallback requires documented isolation, rotation, and revocation

#### Scenario: Recovery key is inspected
- **WHEN** a collaborator inspects Supabase, Vercel, Git, application logs, or the archive catalog
- **THEN** the Restic recovery key is absent
- **AND** the owner retains a recovery copy outside Samson

