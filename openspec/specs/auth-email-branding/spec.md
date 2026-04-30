# auth-email-branding Specification

## Purpose

Define the durable branding and link contract for Supabase-hosted Auth invite
and password recovery email templates.

## Requirements
### Requirement: Auth emails match application branding
The system SHALL render configured Supabase Auth invite and recovery emails with
the dashboard-aligned page layout, AG logo treatment, light and dark application
palettes, heading typography, muted copy, and primary CTA style while remaining
compatible with hosted Supabase HTML templates.

#### Scenario: Invite email uses branded template
- **WHEN** Supabase sends an invite email using the configured template
- **THEN** the email presents the dashboard-style page shell with the AG logo,
  application background, text, and CTA colors
- **AND** the invite CTA remains the obvious primary action

#### Scenario: Recovery email uses branded template
- **WHEN** Supabase sends a password recovery email using the configured
  template
- **THEN** the email presents the dashboard-style page shell with the AG logo,
  application background, text, and CTA colors
- **AND** the reset CTA remains the obvious primary action

#### Scenario: Auth email avoids marketing-card treatment
- **WHEN** Supabase renders a configured invite or recovery email
- **THEN** the message is not wrapped in a decorative centered card, accent
  stripe, radial background, or shadowed marketing panel

### Requirement: Recovery emails avoid extra site URL links
The system SHALL keep the recovery email focused on the reset CTA and SHALL NOT
render a separate app site URL line outside the reset action.

#### Scenario: Recovery email omits site URL footer
- **WHEN** Supabase renders the password recovery email
- **THEN** the body does not include the sentence explaining that the link opens
  the password reset flow at the site URL
- **AND** the email does not render `{{ .SiteURL }}` as a separate footer link

### Requirement: Auth email CTAs use token-hash confirmation
The system SHALL keep configured invite and recovery email CTAs on the
Supabase token-hash confirmation URL contract used by the app.

#### Scenario: Invite CTA verifies through token-hash callback
- **WHEN** Supabase renders the invite email
- **THEN** the CTA URL contains `{{ .RedirectTo }}`, `{{ .TokenHash }}`, and
  `type=invite`

#### Scenario: Recovery CTA verifies through token-hash callback
- **WHEN** Supabase renders the recovery email
- **THEN** the CTA URL contains `{{ .RedirectTo }}`, `{{ .TokenHash }}`, and
  `type=recovery`
