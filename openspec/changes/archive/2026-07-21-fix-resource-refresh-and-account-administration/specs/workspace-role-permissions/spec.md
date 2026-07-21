## ADDED Requirements

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
