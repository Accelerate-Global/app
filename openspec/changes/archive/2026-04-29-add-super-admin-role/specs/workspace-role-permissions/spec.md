## MODIFIED Requirements

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

## ADDED Requirements

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
