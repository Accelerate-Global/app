## MODIFIED Requirements

### Requirement: Basic users cannot update profile or disable account

The system SHALL prevent `basic` users from changing account profile name,
email, or disabling their own account through both UI-visible controls and
server/database enforcement after account setup is complete. Pending invited
`basic` users MUST be able to complete their initial invite password setup.

#### Scenario: Basic invited user completes account setup

- **WHEN** a pending invited `basic` user opens an invite link and sets an initial password
- **THEN** the account setup succeeds and the user can sign in as `basic`

#### Scenario: Basic user opens profile

- **WHEN** a `basic` user opens the profile page
- **THEN** profile name, email update, and self-disable actions are not available

#### Scenario: Basic user attempts self-disable API

- **WHEN** a `basic` user calls the self-disable account API
- **THEN** the response is `403 Forbidden`

#### Scenario: Basic user attempts direct auth profile update

- **WHEN** a `basic` user attempts to update email or user metadata directly through Supabase Auth
- **THEN** the database rejects the update
