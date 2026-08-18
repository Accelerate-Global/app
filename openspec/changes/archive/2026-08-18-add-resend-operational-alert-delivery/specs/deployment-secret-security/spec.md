## ADDED Requirements

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
