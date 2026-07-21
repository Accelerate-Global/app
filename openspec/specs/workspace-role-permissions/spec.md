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

### Requirement: First super-admin bootstrap is provider-owned

The system SHALL treat first super-admin bootstrap as an environment/provider
operation instead of a tracked migration that names a real personal account.

#### Scenario: Environment needs a first super admin

- **WHEN** a deployed environment has no active `super_admin`
- **THEN** an operator must grant the first trusted app-metadata
  `workspace_role` through a provider-owned administrative action
- **AND** the repository does not publish a real personal email address as the
  bootstrap target

#### Scenario: Current permissions run after bootstrap

- **WHEN** a user has trusted app metadata with `workspace_role` set to
  `super_admin`
- **THEN** the existing super-admin permissions and last-active-super-admin
  protections apply unchanged

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

### Requirement: User Management reports successful sign-in recency
The system SHALL show dataset admins each workspace user's most recent successful
Supabase Auth sign-in without representing that timestamp as broader application
activity.

#### Scenario: User has signed in
- **WHEN** a dataset admin views User Management for a user whose
  `auth.users.last_sign_in_at` is present
- **THEN** the Users table shows the timestamp in a `Last sign-in` column
- **AND** the user detail surface labels the same value `Last sign-in`

#### Scenario: User has never signed in
- **WHEN** a dataset admin views User Management for a user without a successful
  sign-in timestamp
- **THEN** the `Last sign-in` column shows `Never`

#### Scenario: Sign-in recency is not generalized activity
- **WHEN** an administrator reviews the Last sign-in value
- **THEN** the application does not label it Last activity
- **AND** the application does not infer session frequency or post-authentication
  activity from the timestamp

### Requirement: Super admins can permanently delete eligible workspace accounts
The system SHALL allow only authenticated super admins to permanently delete an
eligible workspace account through User Management. Deletion MUST be confirmed,
MUST revoke the target's sessions, MUST remove the Supabase Auth account, and
MUST remove the account email from the signup allowlist.

#### Scenario: Super admin deletes another account
- **WHEN** a super admin confirms deletion of an eligible account other than their own
- **THEN** the system revokes the target's active sessions
- **AND** permanently deletes the target Supabase Auth account
- **AND** removes the normalized account email from the signup allowlist
- **AND** removes the account from the User Management list

#### Scenario: Standard admin views an account
- **WHEN** an authenticated standard admin opens a user detail surface
- **THEN** no account deletion action is shown

#### Scenario: Standard admin calls the deletion API
- **WHEN** an authenticated standard admin requests permanent account deletion
- **THEN** the system returns `403 Forbidden`
- **AND** no session, Auth user, or allowlist record is changed

#### Scenario: Super admin attempts self-deletion
- **WHEN** a super admin requests deletion of their own account
- **THEN** the system rejects the request
- **AND** the account remains unchanged

#### Scenario: Super admin attempts to delete the last active super admin
- **WHEN** deletion would remove the last active super-admin account
- **THEN** the system rejects the request
- **AND** the account remains unchanged

#### Scenario: Super admin cancels deletion confirmation
- **WHEN** a super admin opens the account deletion confirmation and cancels
- **THEN** no deletion request is sent

### Requirement: User Management controls use canonical labels and alignment
The User Management invite form SHALL show canonical display labels for roles
and SHALL align the invite action with the email and role controls.

#### Scenario: Invite form initially selects pro
- **WHEN** a dataset admin opens User Management with the default invite role
- **THEN** the closed role selector shows `Pro`
- **AND** it does not show the internal lowercase value `pro`

#### Scenario: Invite form appears at desktop width
- **WHEN** a dataset admin views the invite form at desktop width
- **THEN** the email input, role selector, and invite button share a consistent
  control height and bottom alignment
