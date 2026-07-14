## ADDED Requirements

### Requirement: Workspace accounts are created by administrator invitation only
The system MUST reject public self-signup while allowing authorized administrators to create a pending Auth user and send that user an invitation email.

#### Scenario: Anonymous visitor attempts self-signup
- **WHEN** an anonymous visitor opens the legacy signup route or submits credentials through Supabase public signup
- **THEN** no account is created and the visitor is directed to contact a workspace administrator

#### Scenario: Administrator invites a workspace user
- **WHEN** an authorized administrator submits a valid email and workspace role
- **THEN** the system creates or provisions the pending Auth user through the admin invitation API
- **AND** sends the existing invite email

### Requirement: Invite recipients can complete account setup
Disabling public signup MUST NOT prevent an invited user from verifying an invite callback, choosing a password, remaining signed in, and opening the dashboard.

#### Scenario: Invite recipient follows a valid invite
- **WHEN** a pending user follows a valid token-hash invite callback and submits a valid new password
- **THEN** the password is set
- **AND** the verified session remains active
- **AND** the user is redirected to `/dashboard`

#### Scenario: Administrator resends a pending invite
- **WHEN** an administrator resends an invitation for an eligible pending user
- **THEN** a fresh invite email uses the same verified password-setup flow
