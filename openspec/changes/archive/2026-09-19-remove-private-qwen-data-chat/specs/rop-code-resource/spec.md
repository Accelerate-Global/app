## REMOVED Requirements

### Requirement: Conversational ROP access reuses the complete persisted resource
**Reason**: Conversational ROP access is being removed with Private Qwen.
**Migration**: Delete the chat ROP adapter, continuation/export handoff, and chat tests while preserving the complete persisted ROP resource, page, API, and streamed download.

### Requirement: Dataset use preserves immutable ROP version binding
**Reason**: The requirement governs Qwen queries that combine a primary dataset with ROP classification and the private legacy chat binding is being removed.
**Migration**: Drop the Qwen dataset-resource binding state and chat query path while preserving immutable resource-set lineage required by supported dataset-forming pipelines.

### Requirement: Conversational access does not widen ROP lifecycle mutation authority
**Reason**: No conversational ROP adapter remains.
**Migration**: Delete the chat read-only adapter; keep existing admin-only, same-origin-protected ROP lifecycle surfaces unchanged.
