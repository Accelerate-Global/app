## ADDED Requirements

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
