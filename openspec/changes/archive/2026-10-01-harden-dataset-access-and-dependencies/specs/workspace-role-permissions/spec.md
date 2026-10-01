## ADDED Requirements

### Requirement: Disabled accounts lose direct workspace data access promptly

Disabling a workspace account MUST make its current access token unable to read or mutate workspace data through direct Supabase Data API and Storage policies, regardless of its previous role or JWT expiry time.

#### Scenario: Disabled basic or pro user retains an access token
- **WHEN** a disabled basic or pro user presents an unexpired access token
- **THEN** direct workspace data access is denied

#### Scenario: Disabled admin retains an access token
- **WHEN** a disabled admin presents an unexpired access token
- **THEN** restricted dataset reads and admin data mutations are denied

#### Scenario: User account is re-enabled with a new session
- **WHEN** a re-enabled user signs in and obtains a live session
- **THEN** existing role and dataset visibility rules apply again
