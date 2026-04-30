## ADDED Requirements

### Requirement: Branded password setup emails preserve verified sessions
The system SHALL preserve the existing token-hash password setup callback
contract when changing the visual design of invite and recovery emails.

#### Scenario: Restyled recovery email keeps verified callback session
- **WHEN** a password recovery email is rendered with branded styling
- **THEN** the action link still targets `/auth/confirm` through
  `{{ .RedirectTo }}` with a Supabase token hash, `type=recovery`, and
  `next=/reset-password`

#### Scenario: Restyled invite email keeps verified callback session
- **WHEN** an invite email is rendered with branded styling
- **THEN** the action link still targets `/auth/confirm` through
  `{{ .RedirectTo }}` with a Supabase token hash, `type=invite`, and
  `next=/reset-password`
