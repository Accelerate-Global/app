# workspace-role-permissions Specification

## Purpose
Define the durable contract for workspace role parsing, role management, and
account-level permissions.

## Requirements
### Requirement: Workspace roles are admin, pro, and basic

The system SHALL use `admin`, `pro`, and `basic` as the canonical workspace
roles. Legacy stored role value `viewer` MUST resolve as `pro` for
compatibility, but new role writes MUST use `pro`.

#### Scenario: Legacy viewer role is resolved

- **WHEN** a user has `workspace_role` stored as `viewer`
- **THEN** application role resolution treats the user as `pro`

#### Scenario: Admin manages roles

- **WHEN** an admin invites or updates a workspace user
- **THEN** the selectable role values are `admin`, `pro`, and `basic`

#### Scenario: Missing role defaults to pro

- **WHEN** a user has no recognized workspace role metadata
- **THEN** the application treats the user as `pro`

### Requirement: Basic users cannot update profile or disable account

The system SHALL prevent `basic` users from changing account profile name,
email, or disabling their own account through both UI-visible controls and
server/database enforcement.

#### Scenario: Basic user opens profile

- **WHEN** a `basic` user opens the profile page
- **THEN** profile name, email update, and self-disable actions are not available

#### Scenario: Basic user attempts self-disable API

- **WHEN** a `basic` user calls the self-disable account API
- **THEN** the response is `403 Forbidden`

#### Scenario: Basic user attempts direct auth profile update

- **WHEN** a `basic` user attempts to update email or user metadata directly through Supabase Auth
- **THEN** the database rejects the update

### Requirement: Pro users keep standard account capabilities

The system SHALL preserve current standard-user account capabilities for `pro`
users.

#### Scenario: Pro user updates profile

- **WHEN** a `pro` user updates profile name or starts an email change
- **THEN** the update follows the existing profile update flow

#### Scenario: Pro user disables account

- **WHEN** a `pro` user disables their own account
- **THEN** the existing account disable flow applies
