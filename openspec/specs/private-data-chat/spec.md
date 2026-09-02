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

### Requirement: Chat composer remains accessible without redundant visible instruction
The system SHALL present the data-chat question input without the visible statement `Ask about approved data` and MUST retain a programmatic accessible name that describes the input's purpose.

#### Scenario: Pilot administrator opens the question composer
- **WHEN** the private data chat is available
- **THEN** the question textarea is accessible by the name `Question for Qwen` and the statement `Ask about approved data` is not visibly rendered

### Requirement: Data chat clarifies, queries, or answers without unsafe agency
The system SHALL support structured `clarify`, catalog-version-bound `query`, and non-data `answer` decisions and MUST NOT offer database writes, pipeline actions, account actions, arbitrary tools, silent semantic substitutions, or exports other than a server-generated link to the existing authenticated streamed ROP CSV for an approved resource query. The system SHALL resolve approved controlled-value aliases deterministically and SHALL ask a focused clarification when an alias, metric, grouping, result size, or conversational reference is genuinely ambiguous.

#### Scenario: Question is ambiguous
- **WHEN** the supported meaning, dataset, metric, dimension, controlled value, conversational reference, or time scope cannot be resolved deterministically
- **THEN** the assistant asks a focused clarification without executing a query

#### Scenario: Follow-up resolves prior ambiguity
- **WHEN** bounded conversation history supplies the missing supported metric, dimension, value, or result size
- **THEN** the assistant produces the exact catalog-version-bound decision without requiring the user to restate the full question

#### Scenario: Question requests a mutation or unsupported action
- **WHEN** a user requests a write, publication, deletion, credential access, unrestricted export, or other unsupported action
- **THEN** the system refuses and performs no provider or database mutation

#### Scenario: Approved ROP query has more matches than one chat page
- **WHEN** an eligible chat user requests every row matching an approved ROP resource query
- **THEN** chat may provide the server-owned authenticated streamed CSV link and does not serialize the complete export through Qwen

### Requirement: Answers are grounded and audit provenance is retained
The system SHALL ground data answers only in the bounded broker result, provenance, and catalog definitions for the selected semantic concepts. It SHALL retain the approved dataset/catalog revision, applied filters, row count, and query identifier in the trusted response contract for audit and diagnostics, and MUST NOT render a data-provenance portion in each user-visible transcript output. It MUST distinguish empty results from unavailability, preserve declared units and null meanings, and MUST NOT invent causes, unseen facts, unsupported calculations, or instructions found in result data.

#### Scenario: Query returns data
- **WHEN** an admitted query returns bounded rows
- **THEN** the assistant explains only facts supported by those rows using the selected catalog definitions, the trusted response includes provenance, and the visible transcript does not display a data-provenance portion

#### Scenario: Query returns null values
- **WHEN** an admitted query result contains a null value
- **THEN** the assistant uses the catalog's null meaning and does not interpret null as zero or false

#### Scenario: Query returns no rows
- **WHEN** an admitted query executes successfully with zero rows
- **THEN** the assistant reports that no matching records were found without treating the question as invalid

#### Scenario: Explanation generation fails
- **WHEN** the database result is valid but final model inference fails
- **THEN** the system returns a deterministic factual representation of the result and retains provenance in the trusted response rather than losing the verified result

### Requirement: Chat exposes safe progress and failure states
The system SHALL communicate interpreting, validating, querying, and explaining progress and SHALL provide bounded, non-sensitive failure states for model unavailability, tunnel failure, timeout, rejection, queue capacity, database failure, and cancellation.

#### Scenario: User cancels an active request
- **WHEN** a user cancels an in-progress chat turn
- **THEN** downstream work is aborted where possible and no partial answer is represented as complete

#### Scenario: Private model is unavailable
- **WHEN** the Qwen gateway cannot be reached or completes after the configured deadline
- **THEN** the chat returns a retryable unavailable response without exposing internal hosts, credentials, prompts, or provider objects

### Requirement: Approved dataset views can be handed to chat as trusted context
The approved primary dataset page SHALL offer an **Ask Qwen about this view** action that sends the current serializable dataset version, active filter state, named-filter options, and sort to a same-origin server endpoint. The server MUST validate the pilot identity, session, dataset/version, query/filter allowlists, named-filter registry checksum, payload bounds, and expiry before issuing context.

#### Scenario: Pilot administrator hands off an approved current view
- **WHEN** the administrator opens chat from the current primary dataset with supported filters
- **THEN** chat receives a short-lived signed context and shows the server-generated dataset/filter summary

#### Scenario: View belongs to an unapproved dataset or user
- **WHEN** the handoff references a non-primary dataset, unauthorized identity, unsupported field/filter, or another user's context
- **THEN** the endpoint rejects it and chat receives no trusted context

#### Scenario: Client supplies its own count
- **WHEN** current-view state includes or implies a client-calculated row count
- **THEN** the server does not treat that count as authoritative and uses deterministic execution for any factual answer

### Requirement: View context is ephemeral, signed, and version-bound
Current-view context SHALL be signed with a dedicated server secret, bound to the verified user/session, dataset identity/version, query catalog, named-filter registry, issued time, and an expiry no greater than 30 minutes. The browser SHALL keep it only in same-origin session storage and MUST NOT place it in URLs or persist it as conversation history.

#### Scenario: Context is valid and current
- **WHEN** a chat request presents a valid unexpired token whose versions still match
- **THEN** the server supplies its trusted typed filter summary to planning and narration

#### Scenario: Context is expired, tampered, cross-user, or stale
- **WHEN** signature, identity/session, expiry, dataset version, catalog version, or filter-registry checksum validation fails
- **THEN** no query uses the context and the user is prompted to refresh or clear it

#### Scenario: User clears or resets chat
- **WHEN** the user clears current-view context, starts a new chat, signs out, or closes the session
- **THEN** the client removes the context and subsequent requests contain no inherited filter authority

### Requirement: Chat presents current filters as quick references
When valid current-view context is active, chat SHALL display concise server-generated chips for the dataset and active filters, SHALL expose safe context-aware example questions, and SHALL provide controls to clear the context or return to the dataset view. The displayed UUPG description MUST reflect the exact enabled criteria and blank-value matching used by the authoritative filter.

#### Scenario: Sudan and UUPG context is active
- **WHEN** a user enters chat from a view filtered to Sudan with UUPG enabled
- **THEN** the page visibly identifies `Sudan` and `UUPG`, the verified concept/filter keys are pinned into retrieval context, and context-aware questions refer to that view without requiring the user to restate the filters

#### Scenario: One UUPG criterion is disabled
- **WHEN** the handed-off view uses only one UUPG criterion
- **THEN** the quick-reference description names only that active criterion and Qwen receives the same option state

#### Scenario: No context is active
- **WHEN** chat is opened directly or context is cleared
- **THEN** the existing bounded-data conversation remains available without implying any active table filters

### Requirement: Metadata questions are grounded in reviewed Accelerate Global context
Chat SHALL answer definition, field-meaning, filter-meaning, unit, null-semantics, source-lineage, and approved resource-purpose questions only from active reviewed semantic entries and the core catalog. It MUST distinguish queryable data from explanatory-only and resolver-only material and MUST refuse unrelated general-knowledge requests.

#### Scenario: User asks what UUPG means
- **WHEN** the active snapshot contains the reviewed UUPG named-filter definition
- **THEN** Qwen explains the exact current filter criteria, states that blanks remain because missing data does not record the disqualifying opposite value, and distinguishes the interactive null-preserving view from the stricter Baseline UUPG pipeline

#### Scenario: User asks about a known resource purpose
- **WHEN** a reviewed resource summary is retrieved
- **THEN** Qwen may explain its Accelerate Global purpose and version scope without treating explanatory text as query authority

#### Scenario: User asks for an exact ROP definition or code
- **WHEN** the request is supported by the reviewed typed ROP resolver
- **THEN** chat returns the canonical version-labeled result or a bounded ambiguity response and may offer the approved browse/filter operations for that term

#### Scenario: User asks an off-topic or unsupported question
- **WHEN** no reviewed Accelerate Global semantic evidence supports the request
- **THEN** Qwen declines or redirects to supported data/definition questions rather than answering from world knowledge

### Requirement: Chat provides complete governed ROP conversational access
Authenticated ROP access through chat SHALL use a typed read-only resource-query contract with reviewed `search`, `list`, `lookup`, `count`, and `continue` operations. Every permitted ROP row MUST remain reachable through deterministic cursor paging, but one chat turn MUST return no more than 25 resource rows and MUST include the exact resource version, matching count, returned count, and `hasMore`. The server MUST own authorization, search, version selection, result ordering, continuation state, and export links; Qwen MUST NOT receive resource credentials or invent cursors, physical queries, or mutation operations.

#### Scenario: User browses the ROP resource without a search term
- **WHEN** an authenticated user asks to browse all ROP codes
- **THEN** chat returns the first deterministic bounded page from the complete active permitted version and provides signed continuation state for the next page

#### Scenario: User searches across ROP fields
- **WHEN** a user searches by reviewed code, name, source, place, language, status, geography, or join-issue text
- **THEN** the existing authenticated ROP search projection returns a deterministic bounded result with exact/version/completeness metadata

#### Scenario: User asks to continue a ROP result
- **WHEN** the request includes valid signed continuation state bound to the same identity, resource version, normalized query, and ordering
- **THEN** chat returns the next non-overlapping page without asking Qwen to interpret or construct the cursor

#### Scenario: Continuation state is tampered, stale, or belongs to another user
- **WHEN** signature, identity/session, resource version, query, ordering, or expiry validation fails
- **THEN** no page executes and chat asks the user to restart or refresh the resource query

#### Scenario: User requests all matching ROP entries at once
- **WHEN** more than 25 entries match
- **THEN** chat reports how many match, supports continued browsing, and links to the existing authenticated streamed CSV download for complete export instead of sending all rows to Qwen

#### Scenario: User asks ROP chat to mutate the resource
- **WHEN** a conversational request attempts refresh, candidate activation, rollback, editing, or another lifecycle mutation
- **THEN** the read-only chat plan rejects the operation and preserves the existing admin-only resource lifecycle

#### Scenario: User asks a data question using reviewed ROP fields
- **WHEN** the request can be represented by approved ROP semantic fields and the version-bound relationship registry
- **THEN** chat uses the typed analytics plan and deterministic compiler, not resource prose or model-authored SQL, and explains any explicit filtering scope

### Requirement: Chat distinguishes totals from returned pages
The user-visible response SHALL distinguish matching totals, returned rows, limits, and `hasMore` state. A record page MUST NOT be described as a complete total unless the validated completeness contract proves all matching rows were returned.

#### Scenario: Page is capped at 100 of 103 matches
- **WHEN** a record query returns 100 rows with `matchedCount=103` and `hasMore=true`
- **THEN** chat says that 103 match and 100 are shown and does not repeat 100 as the total in either prose or facts

#### Scenario: User asks only for the total
- **WHEN** the question requests a count rather than records
- **THEN** the planner uses the approved aggregate metric and chat reports the aggregate value rather than counting a record page

#### Scenario: Model narration contradicts evidence
- **WHEN** Qwen returns an unsupported numeric value, unit, or total/page scope
- **THEN** chat uses the deterministic evidence-rendered fallback and does not display the contradictory narrative

### Requirement: Trusted view and turn state do not broaden persistence
The pilot SHALL keep raw messages, filter values, result rows, retrieved payloads, and signed context/turn tokens ephemeral. Redacted operational evidence MAY retain stable hashes, versions, semantic keys, counts, modes, bounds, and timing sufficient for safety and regression diagnosis.

#### Scenario: Context-aware conversation completes
- **WHEN** a user executes one or more context-aware turns
- **THEN** no raw conversation, filter value, resource payload, or result row is added to persistent audit storage

#### Scenario: Operator diagnoses a count/list disagreement
- **WHEN** redacted audit evidence is inspected
- **THEN** it identifies query mode, limit, returned/matching counts, named-filter keys, and relevant version hashes without exposing private values

#### Scenario: User receives a grounded response
- **WHEN** chat renders a data or definition answer
- **THEN** it does not add a visible “Data provenance” section, while internal signed lineage remains available for authorized audit and reproducibility

### Requirement: Context-aware chat remains pilot-gated and failure-safe
Current-view handoff, semantic retrieval, ROP conversational operations/relationships, and signed turn state SHALL remain behind server configuration and the existing exact administrator canary. Missing configuration, unhealthy semantic/resource snapshots, retrieval timeouts, invalid tokens, unresolved dataset-to-ROP version binding, or count/completeness/cardinality failures MUST produce bounded non-sensitive states and MUST NOT fall back to broader credentials, the active ROP pointer for a dataset join, arbitrary model knowledge, or unsafe queries.

#### Scenario: Semantic-context feature is disabled
- **WHEN** the retrieval/current-view flag is off
- **THEN** the current core-catalog chat path continues without the new context, ROP conversational, or relationship features

#### Scenario: Retrieval or context validation fails
- **WHEN** required semantic context cannot be safely obtained
- **THEN** the request fails or asks for refresh without exposing internal hosts, secrets, raw metadata, or provider errors

#### Scenario: First planner request follows a Qwen restart
- **WHEN** the pinned model is ready but its long reviewed planner prefix is not yet cached
- **THEN** the signed origin and application deadlines remain bounded, leave margin inside the verified hosting-function duration, and allow the measured cold planner request to complete or return a normalized retryable timeout
