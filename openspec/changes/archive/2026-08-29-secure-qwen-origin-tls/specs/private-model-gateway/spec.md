## MODIFIED Requirements

### Requirement: The Cloudflare edge relay is least-privilege and credential-stripping
The system SHALL protect the Worker relay with Cloudflare Access before execution, SHALL bind it to one VPC Service for the exact Samson gateway host and port, and SHALL accept only the health, planning, and grounded-answer routes. The Cloudflare-to-Samson HTTPS hop MUST validate a trusted certificate whose hostname matches the Worker's private origin identity, MUST use full certificate verification, and MUST fail closed on certificate-chain, expiry, or hostname errors. The private origin identity MUST NOT require a public DNS record or public Tunnel route. The relay MUST bound request and response bodies, MUST forward only the required content and application-signing headers, and MUST NOT forward Access credentials, cookies, arbitrary headers, internal provider errors, or database credentials.

#### Scenario: Vercel sends a valid service-authenticated request
- **WHEN** Cloudflare Access admits the Vercel service token, the request matches an allowed route and bound, and the Samson certificate is trusted and matches the requested private origin hostname
- **THEN** the relay forwards the exact HMAC-covered body and allowlisted headers through the VPC Service without exposing another private destination

#### Scenario: Samson presents an invalid origin identity
- **WHEN** the origin certificate is untrusted, expired, or does not match the Worker's private origin hostname
- **THEN** the VPC Service rejects the origin connection and the relay returns a normalized unavailable response without retrying through unverified TLS

#### Scenario: Caller supplies an unexpected route, header, or oversized payload
- **WHEN** a request does not match the relay contract
- **THEN** the relay rejects it before the VPC Service call and does not forward Access credentials or sensitive error details

#### Scenario: Public DNS does not contain the private origin identity
- **WHEN** the Worker requests the private origin hostname through its VPC Service binding
- **THEN** the binding routes to the configured Samson tunnel address and port without requiring a public DNS address record or public Tunnel hostname
