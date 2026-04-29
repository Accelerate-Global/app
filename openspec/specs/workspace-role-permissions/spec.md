# workspace-role-permissions Specification

## Purpose
Define the durable contract for workspace role parsing, role management, and
account-level permissions.
## Requirements
### Requirement: Workspace roles are admin, pro, and basic

The system SHALL use `super_admin`, `admin`, `pro`, and `basic` as the
canonical workspace roles. Legacy stored role value `viewer` MUST resolve as
`pro` for compatibility, but new role writes MUST use `pro`.

#### Scenario: Legacy viewer role is resolved

- **WHEN** a user has `workspace_role` stored as `viewer`
- **THEN** application role resolution treats the user as `pro`

#### Scenario: Admin manages roles

- **WHEN** an admin invites or updates a workspace user
- **THEN** the selectable role values are `admin`, `pro`, and `basic`

#### Scenario: Super admin manages roles

- **WHEN** a super admin invites or updates a workspace user
- **THEN** the selectable role values are `super_admin`, `admin`, `pro`, and
  `basic`

#### Scenario: Missing role defaults to pro

- **WHEN** a user has no recognized workspace role metadata
- **THEN** the application treats the user as `pro`

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

### Requirement: Pro users keep standard account capabilities

The system SHALL preserve current standard-user account capabilities for `pro`
users.

#### Scenario: Pro user updates profile

- **WHEN** a `pro` user updates profile name or starts an email change
- **THEN** the update follows the existing profile update flow

#### Scenario: Pro user disables account

- **WHEN** a `pro` user disables their own account
- **THEN** the existing account disable flow applies

### Requirement: Super admins are admin-capable

The system SHALL treat `super_admin` as admin-capable anywhere existing admin
access is required.

#### Scenario: Super admin opens admin surfaces

- **WHEN** an authenticated `super_admin` opens an admin-only page or calls an
  admin-only API
- **THEN** the system grants the same access currently granted to `admin`

#### Scenario: Super admin passes database admin checks

- **WHEN** a database policy or helper checks whether the current user is a
  dataset admin
- **THEN** users with `workspace_role` `admin` or `super_admin` pass the check

### Requirement: Super admin mutation is protected

The system SHALL allow only super admins to assign the `super_admin` role or
change another super admin's role or disabled status.

#### Scenario: Standard admin cannot assign super admin

- **WHEN** an authenticated `admin` invites or updates a user with
  `workspace_role` `super_admin`
- **THEN** the system rejects the request

#### Scenario: Standard admin cannot change super admin account

- **WHEN** an authenticated `admin` changes the role or disabled status of a
  `super_admin` account
- **THEN** the system rejects the request

#### Scenario: Super admin changes another user

- **WHEN** an authenticated `super_admin` changes another user's role or disabled
  status
- **THEN** the system applies the change when the last active super-admin and
  admin-capable protections remain satisfied

#### Scenario: Last active super admin is protected

- **WHEN** a mutation would disable or demote the last active `super_admin`
- **THEN** the system rejects the request

### Requirement: Blake account is promoted when present

The system SHALL promote the existing `admin@example.com` Auth user to
`super_admin` through the tracked Supabase migration when that user exists.

#### Scenario: Blake user exists during migration

- **WHEN** the super-admin migration runs and an Auth user with email
  `admin@example.com` exists
- **THEN** the user's trusted app metadata stores `workspace_role` as
  `super_admin`

#### Scenario: Blake user is absent during migration

- **WHEN** the super-admin migration runs and no Auth user with email
  `admin@example.com` exists
- **THEN** the migration does not create an Auth user

### Requirement: Accepted invited accounts are not pending invites
The system SHALL treat invited accounts as pending only until the invite has
been accepted or the account is otherwise confirmed.

#### Scenario: Confirmed invited account is active
- **WHEN** an invited user has a confirmed timestamp or email confirmed timestamp
- **THEN** User Management reports the account as active rather than pending
  invite

#### Scenario: Unaccepted invited account is pending
- **WHEN** an invited user has no confirmed timestamp, no email confirmed
  timestamp, and no last login timestamp
- **THEN** User Management reports the account as pending invite
