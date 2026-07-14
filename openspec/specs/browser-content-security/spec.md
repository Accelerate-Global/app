# browser-content-security Specification

## Purpose
Define the browser script-execution boundary for rendered application pages so
that request-scoped nonces authorize required scripts while injected inline
scripts and the retired Vercel Web Analytics collector remain blocked.

## Requirements
### Requirement: Production scripts require a request nonce
The system MUST issue a cryptographically unpredictable nonce for each rendered request and MUST NOT include `unsafe-inline` in production `script-src`.

#### Scenario: Browser renders an application page
- **WHEN** the proxy forwards an application page request
- **THEN** the request and response contain a matching nonce-bearing Content Security Policy
- **AND** the application theme bootstrap script carries that nonce

#### Scenario: Inline script lacks the nonce
- **WHEN** a browser evaluates an inline script without the request nonce
- **THEN** the production Content Security Policy blocks that script

### Requirement: Vercel Web Analytics collector remains absent
The browser policy and root layout MUST NOT load or allow the Vercel Web Analytics collector.

#### Scenario: Application shell renders
- **WHEN** any application page renders
- **THEN** no Vercel Web Analytics component is mounted
- **AND** the collector script origin is absent from the Content Security Policy
