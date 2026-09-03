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
The system SHALL protect the Worker relay with Cloudflare Access before execution, SHALL bind it to one VPC Service for the exact Samson gateway host and port, and SHALL accept only the health, planning, and grounded-answer routes. The relay MUST bound request and response bodies, MUST forward only the required content and application-signing headers, and MUST NOT forward Access credentials, cookies, arbitrary headers, internal provider errors, or database credentials.

#### Scenario: Vercel sends a valid service-authenticated request
- **WHEN** Cloudflare Access admits the Vercel service token and the request matches an allowed route and bound
- **THEN** the relay forwards the exact HMAC-covered body and allowlisted headers through the VPC Service without exposing another private destination

#### Scenario: Caller supplies an unexpected route, header, or oversized payload
- **WHEN** a request does not match the relay contract
- **THEN** the relay rejects it before the VPC Service call and does not forward Access credentials or sensitive error details

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
The system SHALL qualify private-chat latency with sanitized cold and warm phase evidence that distinguishes semantic retrieval, planner prompt ingestion, planner generation, deterministic resolution/query work, grounded-answer work when invoked, provider/relay overhead, and single-slot busy rejection. Measurements MUST NOT retain raw prompts, conversation text, result rows, credentials, authorization headers, model output, or private provider errors.

#### Scenario: Operator measures a representative analytical turn
- **WHEN** an approved sanitized or read-only canary is executed
- **THEN** the resulting evidence reports phase samples plus p50 and p95 summaries sufficient to distinguish model work from application and relay overhead

#### Scenario: Model is cold
- **WHEN** the pinned model has restarted and its planner prefix is absent from the KV cache
- **THEN** cold prompt-ingestion and generation timing is reported separately from subsequent warm requests

#### Scenario: Single inference slot is occupied
- **WHEN** a second valid request arrives while the model slot is active
- **THEN** the gateway rejects it with the existing bounded busy response and the latency evidence records rejection rather than treating it as queued execution

#### Scenario: Optimized application candidate is deployed
- **WHEN** the deterministic analytical-result path is deployed to the exact administrator canary
- **THEN** the unchanged complete one-user production canary MUST pass and replace composed warm-path estimates with measured SSE p50 and p95 evidence before release acceptance or pilot expansion

