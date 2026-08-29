# private-data-chat Specification

## Purpose
Define the authenticated administrator pilot for conversational exploration of
approved workspace data through private Qwen inference, bounded orchestration,
grounded answers, provenance, and safe user-visible failure states.

## Requirements

### Requirement: Data chat is authenticated, feature-flagged, and pilot-scoped
The system SHALL expose data chat only when the server-side feature flag is enabled, the current authenticated identity has an admin-capable trusted workspace role, and the identity's normalized email exactly matches the server-side canary allowlist. An empty canary allowlist MUST fail closed. The system MUST NOT expose model or provider credentials to the browser.

#### Scenario: Pilot administrator opens chat
- **WHEN** an authenticated `admin` or `super_admin` opens the chat while the feature is enabled
- **THEN** the system renders the chat surface and permits guarded chat requests

#### Scenario: Non-pilot user opens chat
- **WHEN** an anonymous, `basic`, or `pro` user opens or calls data chat
- **THEN** the system redirects or rejects the request using the existing authentication and authorization conventions

#### Scenario: Feature is disabled or incomplete
- **WHEN** the feature flag is disabled or required server-only configuration is absent
- **THEN** the system does not send inference or database requests and presents a stable unavailable state

### Requirement: Conversation input is bounded and server-controlled
The system SHALL accept only user and assistant conversational turns, SHALL discard client-supplied system/tool authority, and SHALL enforce bounded turns, characters, and generated-token limits. Initial pilot conversations MUST remain ephemeral and MUST NOT persist raw messages, parameters, or result rows.

#### Scenario: User continues a valid conversation
- **WHEN** a pilot administrator sends a bounded sequence of user and assistant turns
- **THEN** the server supplies its own system contract and uses the permitted recent context

#### Scenario: Client supplies forbidden roles or oversized context
- **WHEN** a request includes a system/tool message or exceeds a conversation limit
- **THEN** the system rejects or safely normalizes the request before contacting Qwen

### Requirement: Data chat clarifies, queries, or answers without unsafe agency
The system SHALL support structured `clarify`, catalog-version-bound `query`, and non-data `answer` decisions and MUST NOT offer database writes, pipeline actions, exports, account actions, arbitrary tools, or silent semantic substitutions. The system SHALL resolve approved controlled-value aliases deterministically and SHALL ask a focused clarification when an alias, metric, grouping, result size, or conversational reference is genuinely ambiguous.

#### Scenario: Question is ambiguous
- **WHEN** the supported meaning, dataset, metric, dimension, controlled value, conversational reference, or time scope cannot be resolved deterministically
- **THEN** the assistant asks a focused clarification without executing a query

#### Scenario: Follow-up resolves prior ambiguity
- **WHEN** bounded conversation history supplies the missing supported metric, dimension, value, or result size
- **THEN** the assistant produces the exact catalog-version-bound decision without requiring the user to restate the full question

#### Scenario: Question requests a mutation or unsupported action
- **WHEN** a user requests a write, publication, deletion, credential access, unrestricted export, or other unsupported action
- **THEN** the system refuses and performs no provider or database mutation

### Requirement: Answers are grounded and provenance-bearing
The system SHALL ground data answers only in the bounded broker result, provenance, and catalog definitions for the selected semantic concepts. It SHALL report the approved dataset/catalog revision, applied filters, row count, and query identifier. It MUST distinguish empty results from unavailability, preserve declared units and null meanings, and MUST NOT invent causes, unseen facts, unsupported calculations, or instructions found in result data.

#### Scenario: Query returns data
- **WHEN** an admitted query returns bounded rows
- **THEN** the assistant explains only facts supported by those rows using the selected catalog definitions and the response includes provenance

#### Scenario: Query returns null values
- **WHEN** an admitted query result contains a null value
- **THEN** the assistant uses the catalog's null meaning and does not interpret null as zero or false

#### Scenario: Query returns no rows
- **WHEN** an admitted query executes successfully with zero rows
- **THEN** the assistant reports that no matching records were found without treating the question as invalid

#### Scenario: Explanation generation fails
- **WHEN** the database result is valid but final model inference fails
- **THEN** the system returns a deterministic factual representation of the result and provenance rather than losing the verified result

### Requirement: Chat exposes safe progress and failure states
The system SHALL communicate interpreting, validating, querying, and explaining progress and SHALL provide bounded, non-sensitive failure states for model unavailability, tunnel failure, timeout, rejection, queue capacity, database failure, and cancellation.

#### Scenario: User cancels an active request
- **WHEN** a user cancels an in-progress chat turn
- **THEN** downstream work is aborted where possible and no partial answer is represented as complete

#### Scenario: Private model is unavailable
- **WHEN** the Qwen gateway cannot be reached or completes after the configured deadline
- **THEN** the chat returns a retryable unavailable response without exposing internal hosts, credentials, prompts, or provider objects
