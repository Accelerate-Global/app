## ADDED Requirements

### Requirement: Verified private-origin TLS identity is reproducible from source
The system SHALL keep the source-controlled Worker request hostname aligned
with the exact hostname validated by the live Cloudflare VPC Service and Samson
Origin CA certificate. The VPC Service MUST retain full chain and hostname
verification, and the hostname MUST remain an identity input rather than a
public routing dependency.

#### Scenario: Worker calls the private Samson origin
- **WHEN** the Worker forwards an allowed HTTPS request through its bound VPC Service
- **THEN** the request hostname supplies `samson.risencode.org` as HTTP `Host` and TLS SNI
- **AND** the VPC Service routes only to its configured private host and port with `verify_full`

#### Scenario: Checked-in and live TLS identities drift
- **WHEN** release verification finds that the deployed Worker hostname, VPC verification mode, certificate identity, and checked-in source do not agree
- **THEN** the release is blocked until the checked-in source and durable operations evidence reproduce the verified live state

#### Scenario: Operator redeploys the Worker from the canonical repository
- **WHEN** the Worker is built and deployed from canonical `main`
- **THEN** the resulting relay preserves the existing Access, HMAC, route allowlist, bounded-body, credential-stripping, private-route, and verified-hostname guarantees
