## MODIFIED Requirements

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
