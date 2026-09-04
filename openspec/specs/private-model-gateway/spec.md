# private-model-gateway Specification

## Purpose
Define the least-privilege server-to-server path from the application to local
Qwen inference, including machine authentication, replay resistance, bounded
relay behavior, containment, normalized failures, and deterministic testability.
## Requirements
### Requirement: Qwen is reachable only through a server-to-server gateway
The system SHALL keep llama.cpp unavailable to browsers and public clients and SHALL permit application inference only through a server-side gateway contract. The gateway MUST NOT possess a database credential or database execution tool.

#### Scenario: Vercel backend calls the gateway
- **WHEN** the server sends a correctly authenticated and signed plan or answer request
- **THEN** the gateway validates the request and may forward the bounded inference payload to local Qwen

#### Scenario: Browser or unauthenticated caller calls the gateway
- **WHEN** a caller lacks machine authentication or a valid application signature
- **THEN** the request is rejected before inference and no model metadata or internal address is exposed

### Requirement: Gateway requests are authenticated, replay-resistant, and bounded
The gateway SHALL require machine authentication plus an HMAC over method, path, timestamp, nonce, and body digest. It SHALL reject expired timestamps, repeated nonces, invalid signatures, unexpected content types, oversized bodies, unsupported modes, and token limits.

#### Scenario: Signed request is replayed
- **WHEN** a previously accepted nonce/signature pair is submitted again
- **THEN** the gateway rejects the replay without invoking Qwen

#### Scenario: Request exceeds an inference limit
- **WHEN** a request exceeds body, context, output-token, duration, or queue limits
- **THEN** the gateway returns a stable bounded error and does not overcommit the model service

### Requirement: Gateway preserves the model's containment boundary
The deployed gateway SHALL communicate with loopback llama.cpp, SHALL expose only health, planning, and grounded-answer operations, and SHALL not grant shell, file, arbitrary URL, arbitrary tool, or database access to Qwen.

#### Scenario: Prompt requests a local or external tool
- **WHEN** user or data content asks Qwen to access files, network resources, credentials, tools, or databases
- **THEN** no such capability is available and the response remains within the declared inference schema

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

### Requirement: Gateway failures are stable and observable without sensitive logs
The gateway SHALL expose normalized unavailable, busy, invalid, timeout, and internal failure classes and SHALL record bounded operational metadata without raw prompts, result data, authorization headers, HMAC secrets, or model API keys.

#### Scenario: Qwen service restarts or times out
- **WHEN** llama.cpp is loading, unavailable, or exceeds its deadline
- **THEN** the gateway returns the matching normalized retryable state and does not leak internal failure details

### Requirement: Routine tests do not depend on live Samson availability
The application SHALL provide a deterministic fake implementation of the gateway contract for unit, route, local Supabase, and UI smoke tests. A separate pinned sanitized evaluation MUST exercise the real Qwen service before pilot release and whenever the model, prompt, schema, catalog, or compiler contract changes.

#### Scenario: Repository verification runs without Samson
- **WHEN** routine deterministic verification executes
- **THEN** the fake gateway produces schema-valid fixed planning and answer results without external network access

#### Scenario: Pinned AI contract changes
- **WHEN** a release changes the model digest, runtime, system prompt, response schema, semantic catalog, or compiler policy
- **THEN** a fresh real-Qwen evaluation receipt is required before pilot enablement

### Requirement: Latency qualification preserves private-model containment
The system SHALL qualify private-chat latency with sanitized cold and warm phase evidence that distinguishes semantic retrieval, planner prompt ingestion, planner generation, deterministic resolution/query work, grounded-answer work when invoked, provider/relay overhead, and single-slot busy rejection. Planner inference SHALL preserve the validated retrieval status, snapshot and policy identity, controlled retrieval views, exact-match keys, context byte count, selected reviewed items, and explicit non-instruction authority while omitting the duplicate serialized copy of those items. Measurements MUST NOT retain raw prompts, conversation text, result rows, credentials, authorization headers, model output, or private provider errors.

#### Scenario: Planner receives retrieved semantic evidence
- **WHEN** application retrieval returns a validated ready context
- **THEN** the gateway preserves its established validation and selection metadata, sends the reviewed items once with `instructionAuthority: false`, and omits only the duplicate serialized item envelope

#### Scenario: Compaction changes a supported decision
- **WHEN** a canary returns clarification or refusal for an unchanged supported query case
- **THEN** production is rolled back, pilot scope is not expanded, and the optimization cannot be accepted until the exact regression and complete suite pass

#### Scenario: Operator measures varied analytical turns
- **WHEN** an approved sanitized or read-only canary executes distinct questions with different selected cards
- **THEN** the resulting evidence reports prompt-token, phase, and browser p50/p95 summaries without treating repeated identical-context cache reuse as representative of the varied workload

#### Scenario: Single inference slot is occupied
- **WHEN** a second valid request arrives while the model slot is active
- **THEN** the gateway rejects it with the existing bounded busy response and the latency evidence records rejection rather than treating it as queued execution

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

