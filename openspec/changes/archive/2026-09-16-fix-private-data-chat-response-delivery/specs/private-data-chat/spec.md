## MODIFIED Requirements

### Requirement: Chat exposes safe progress and failure states
The system SHALL show an immediate cancellable in-progress state while a chat turn runs, SHALL bind response completion to the awaited bounded orchestration result, and SHALL deliver the completed answer or normalized failure to the browser as soon as that result is available rather than waiting for the hosting-function duration boundary. The system SHALL provide bounded, non-sensitive failure states for model unavailability, tunnel failure, timeout, rejection, queue capacity, database failure, and cancellation. A non-token-streaming turn MUST NOT depend on a manually detached streaming response lifecycle.

#### Scenario: Completed turn reaches the browser promptly
- **WHEN** planning, validation, approved querying, audit recording, and deterministic answer rendering complete within their configured deadlines
- **THEN** the browser receives the bounded answer immediately after orchestration settles, clears the in-progress state, and does not wait for the hosting-function duration boundary

#### Scenario: User cancels an active request
- **WHEN** a user cancels an in-progress chat turn
- **THEN** downstream work is aborted where possible and no partial answer is represented as complete

#### Scenario: Private model is unavailable
- **WHEN** the Qwen gateway cannot be reached or completes after the configured deadline
- **THEN** the chat returns a retryable unavailable response without exposing internal hosts, credentials, prompts, or provider objects
