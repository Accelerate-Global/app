## MODIFIED Requirements

### Requirement: Existing API connection safety controls remain enforced
The system SHALL preserve API connection security and compatibility controls during async execution while treating saved profile definitions as codebase-managed records outside the web UI. Outbound connections MUST use the validated public address for the actual connection, and credential-bearing requests MUST NOT cross origins during redirects.

#### Scenario: Secrets and blocked URLs remain protected
- **WHEN** an async run executes
- **THEN** the system uses stored secret headers, redacts secret values from logs/previews/errors, requires safe HTTPS URLs, blocks all non-public and special-use networks, pins the validated DNS address, enforces redirect limits, enforces response-size limits, and uses the configured timeout

#### Scenario: Same-origin redirect occurs
- **WHEN** a validated upstream redirects to another HTTPS URL on the same origin
- **THEN** the system revalidates and follows the redirect within the configured limit

#### Scenario: Cross-origin redirect occurs
- **WHEN** an upstream redirects a request to a different origin
- **THEN** the system rejects the redirect without forwarding request headers, connector secrets, or a sensitive request body

#### Scenario: DNS result changes after validation
- **WHEN** a hostname resolves to a public address during validation and a non-public address during a later resolver lookup
- **THEN** the actual connection remains pinned to the validated public address or fails without contacting the non-public address

#### Scenario: Existing run behavior remains compatible
- **WHEN** admins test or import saved API connection profiles through the allowed run endpoints
- **THEN** the system preserves existing profile fields, same-origin secret-header behavior, and create-or-replace dataset import semantics
