## Purpose

Define the expected password setup session behavior for Supabase invite and
password recovery callbacks.

## Requirements

### Requirement: Password setup keeps the verified session
The system SHALL keep the Supabase callback session active after a successful
invite or recovery password setup and SHALL send the user to the authenticated
dashboard.

#### Scenario: Password setup completes from a verified callback session
- **WHEN** a user with a valid Supabase invite or recovery callback session
  submits matching new password fields
- **THEN** the system updates the user's password
- **AND** the user remains signed in
- **AND** the browser is redirected to `/dashboard`

#### Scenario: Server-verified setup redirects preserve callback host
- **WHEN** a Supabase token-hash callback is verified server-side
- **THEN** the redirect to `/reset-password` uses the same browser-visible host
  that received the callback
- **AND** the browser sends the newly set Supabase session cookies to
  `/reset-password`

#### Scenario: Password setup failure remains recoverable
- **WHEN** the password update fails or the callback session cannot be restored
- **THEN** the system shows the existing reset-password error state
- **AND** the user is not redirected to the dashboard

### Requirement: Password setup links establish a verified callback session
The system SHALL route invite and recovery email callbacks through a Supabase
token-hash verification step before showing the password setup form.

#### Scenario: Recovery email callback verifies before reset-password renders
- **WHEN** a password recovery email is generated
- **THEN** the action link targets `/auth/confirm` with a Supabase token hash,
  `type=recovery`, and `next=/reset-password`
- **AND** successful verification redirects the browser to `/reset-password`
  with a session available

#### Scenario: Invite email callback verifies before reset-password renders
- **WHEN** a workspace invite email is generated
- **THEN** the action link targets `/auth/confirm` with a Supabase token hash,
  `type=invite`, and `next=/reset-password`
- **AND** successful verification redirects the browser to `/reset-password`
  with a session available

#### Scenario: Direct token-hash reset-password callbacks remain recoverable
- **WHEN** `/reset-password` receives a supported Supabase token hash callback
- **THEN** the page verifies the token hash
- **AND** the password setup form is shown after successful verification
