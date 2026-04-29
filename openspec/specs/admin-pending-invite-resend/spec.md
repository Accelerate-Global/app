# admin-pending-invite-resend Specification

## Purpose
Define the admin workflow for resending Supabase invite emails to users whose
workspace invitation is still pending.

## Requirements
### Requirement: Admins can resend pending invite emails
The system SHALL allow an authenticated admin to resend a fresh Supabase invite
email to a workspace user only while that user's invite is still pending.

#### Scenario: Admin resends a pending invite
- **WHEN** an authenticated admin resends the invite for a user with an email,
  an invite sent timestamp, no confirmed timestamp, no email confirmed
  timestamp, and no last login timestamp
- **THEN** the system sends a fresh Supabase invite email using the existing
  invite template and `/reset-password` redirect
- **AND** returns the refreshed workspace user record

#### Scenario: Non-admin cannot resend an invite
- **WHEN** an unauthenticated or non-admin user requests invite resend
- **THEN** the system rejects the request before calling Supabase Auth Admin

#### Scenario: Accepted account cannot receive invite resend
- **WHEN** an admin requests invite resend for a user whose invite is no longer
  pending
- **THEN** the system rejects the request without sending a new invite email

#### Scenario: Pending invite action is visible
- **WHEN** an admin opens the User Management detail sheet for a pending invited
  user
- **THEN** the sheet exposes a resend invite email action instead of a password
  reset action
