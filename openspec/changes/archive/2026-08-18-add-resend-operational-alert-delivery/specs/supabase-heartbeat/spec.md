## ADDED Requirements

### Requirement: Supabase heartbeat has a Resend outage fallback
The system SHALL attempt a direct Resend operational email when an authorized Vercel heartbeat detects that Supabase is unavailable.

#### Scenario: Supabase read fails and email is configured
- **WHEN** an authorized heartbeat request receives an error from any bounded read-only Supabase check
- **THEN** the heartbeat sends a sanitized high-severity outage email directly through Resend
- **AND** uses a deterministic daily idempotency key
- **AND** returns the existing HTTP 503 heartbeat response

#### Scenario: Supabase read fails and email delivery also fails
- **WHEN** the heartbeat detects a Supabase failure but Resend configuration or delivery fails
- **THEN** the heartbeat logs normalized email-delivery details
- **AND** returns the existing HTTP 503 Supabase heartbeat response
- **AND** does not attempt to persist the fallback alert in Supabase

#### Scenario: Supabase reads succeed
- **WHEN** all authorized heartbeat reads succeed
- **THEN** the heartbeat does not call Resend
- **AND** returns the existing HTTP 200 success response
