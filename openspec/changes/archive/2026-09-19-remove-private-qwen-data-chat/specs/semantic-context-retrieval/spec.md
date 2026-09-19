## REMOVED Requirements

### Requirement: Semantic context is built as a reviewed immutable snapshot
**Reason**: The Qwen semantic-context catalog and its snapshots are being removed.
**Migration**: Delete semantic Storage objects, manifests, versions, entries, findings, activation events, and the catalog resource in verified order.

### Requirement: Runtime definitions and guiding documents stay synchronized
**Reason**: No Qwen runtime semantic definitions or guiding-document endpoint remains.
**Migration**: Delete semantic generation/synchronization code, guiding documents, endpoint, scripts, and tests.

### Requirement: Every semantic entry declares authority and audience
**Reason**: Semantic entries are being deleted rather than served to another consumer.
**Migration**: Remove the semantic entry schema and stored entries without changing generic reference-resource schemas.

### Requirement: Retrieval uses the smallest benchmark-qualified tier
**Reason**: The retrieval tier, embedding/reranker candidates, and benchmarks are being removed.
**Migration**: Delete hybrid retrieval code, benchmark corpora/scripts/docs, model candidates, and evaluation receipts.

### Requirement: Context assembly uses verified query views and typed coverage
**Reason**: No Qwen context assembly or analytics query view remains.
**Migration**: Delete assembly/projection code and Qwen analytics views while preserving non-chat typed resource APIs.

### Requirement: Retrieved planning examples are reviewed and isolated from evaluation
**Reason**: There is no remaining retrieval planner or semantic evaluation suite.
**Migration**: Delete planning examples and evaluation corpora rather than migrating them to another feature.

### Requirement: Retrieved content cannot act as instructions or authority
**Reason**: No retrieved content is sent to a model after removal.
**Migration**: Delete the retrieval boundary and its tests; retain normal application input/security controls.

### Requirement: Large resources use typed retrieval without prompt bulk-injection
**Reason**: Qwen will no longer retrieve or receive large resource content.
**Migration**: Delete the chat typed-retrieval adapter while preserving the standalone paged/downloadable ROP resource.

### Requirement: Retrieval failures and staleness fail safely
**Reason**: The product no longer exposes retrieval or retrieval failure states.
**Migration**: Retired routes return not found; generic resource health behavior remains unchanged.

### Requirement: Retrieval lineage is auditable without retaining sensitive content
**Reason**: Semantic retrieval and its audit lineage are being removed.
**Migration**: Delete live Qwen audit rows and retain only sanitized decommission evidence.

### Requirement: Retrieval quality is independently release-tested
**Reason**: There is no retrieval capability to qualify after decommission.
**Migration**: Delete retrieval evaluation tests, scripts, generated reviews, and release gates specific to Qwen.

### Requirement: Trusted geography resolution prevents false off-topic refusal
**Reason**: Qwen off-topic classification and geography resolution are being removed.
**Migration**: Delete chat-specific resolution logic while retaining neutral country and filter-region aliases used elsewhere.
