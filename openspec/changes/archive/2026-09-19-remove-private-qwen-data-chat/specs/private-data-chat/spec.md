## REMOVED Requirements

### Requirement: Data chat is authenticated, feature-flagged, and pilot-scoped
**Reason**: The Private Qwen pilot is being removed for every identity and role.
**Migration**: Disable admission first, then delete the page, routes, access checks, flags, canary configuration, and navigation.

### Requirement: Conversation input is bounded and server-controlled
**Reason**: The application will no longer accept conversational input for Qwen.
**Migration**: Delete the request schema, conversation normalization, and orchestration path.

### Requirement: Chat composer remains accessible without redundant visible instruction
**Reason**: The chat composer is being removed.
**Migration**: Delete the chat client and its UI tests/smoke registration.

### Requirement: Data chat clarifies, queries, or answers without unsafe agency
**Reason**: No conversational query or answer capability remains in the product.
**Migration**: Delete the planners, allowed tool/query contracts, clarification behavior, and chat export handoff.

### Requirement: Answers are grounded and audit provenance is retained
**Reason**: No Qwen answer is produced and live chat audit data is being deleted.
**Migration**: Remove evidence rendering, grounding, provenance response state, and audit persistence after admission closes.

### Requirement: Chat exposes safe progress and failure states
**Reason**: The chat request lifecycle and its failure states are being removed.
**Migration**: Delete the client progress/cancel UI and API completion/error contract; retired routes return not found.

### Requirement: Approved dataset views can be handed to chat as trusted context
**Reason**: Dataset-to-Qwen handoff is being removed.
**Migration**: Delete the dataset action, signing endpoint, payload validation, navigation, and tests while preserving normal dataset filters/actions.

### Requirement: View context is ephemeral, signed, and version-bound
**Reason**: No chat view-context token remains.
**Migration**: Delete the signing key contract, token code, browser session state, and sign-out cleanup specific to Qwen.

### Requirement: Chat presents current filters as quick references
**Reason**: The chat page and its current-view chips/examples are being removed.
**Migration**: Delete the chat-only presentation while preserving the authoritative dataset filter display and behavior.

### Requirement: Metadata questions are grounded in reviewed Accelerate Global context
**Reason**: The product will no longer answer metadata questions conversationally.
**Migration**: Delete the semantic question path and retain direct resource/catalog pages for supported metadata.

### Requirement: Chat provides complete governed ROP conversational access
**Reason**: Conversational ROP access is being removed.
**Migration**: Delete chat adapters, continuation state, and chat export links while preserving the standalone ROP page/API/download/lifecycle.

### Requirement: Chat distinguishes totals from returned pages
**Reason**: No chat result page remains.
**Migration**: Delete chat evidence/completeness rendering; preserve ordinary resource and dataset pagination contracts.

### Requirement: Trusted view and turn state do not broaden persistence
**Reason**: Signed Qwen view/turn state and Qwen audit persistence are being removed.
**Migration**: Delete token code and live audit/control rows without exporting raw chat content.

### Requirement: Context-aware chat remains pilot-gated and failure-safe
**Reason**: Context-aware chat, semantic retrieval, ROP conversation, and the Qwen pilot gate are being removed together.
**Migration**: Disable the pilot before deleting its configuration, retrieval path, resource bindings, and failure states.

### Requirement: Natural geographic population questions remain in reviewed scope
**Reason**: The product will no longer accept natural-language population questions through Qwen.
**Migration**: Delete the chat resolver/planner path while preserving neutral country/filter-region data used by non-chat features.
