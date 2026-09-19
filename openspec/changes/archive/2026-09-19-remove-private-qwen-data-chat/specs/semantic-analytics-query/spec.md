## REMOVED Requirements

### Requirement: Analytics uses a versioned approved semantic catalog
**Reason**: The Qwen analytics layer and semantic catalog are being removed.
**Migration**: Delete the catalog bindings and semantic resource after preserving generic reference-resource behavior.

### Requirement: Qwen returns structured plans rather than SQL
**Reason**: Qwen will no longer plan analytics requests.
**Migration**: Delete the planner schema, prompts, model calls, and validation path.

### Requirement: SQL compilation is deterministic and parameterized
**Reason**: The deterministic compiler exists only to execute Qwen analytics plans.
**Migration**: Delete the chat compiler/query path and preserve ordinary parameterized application/database access.

### Requirement: Semantic metadata reuses trusted Accelerate Global vocabulary without widening access
**Reason**: No semantic analytics metadata consumer remains.
**Migration**: Delete chat semantic metadata while retaining the underlying product vocabulary and direct resource pages used elsewhere.

### Requirement: Semantic regression evaluation is release-blocking
**Reason**: The semantic analytics capability and its evaluation gate are being removed.
**Migration**: Delete Qwen evaluation suites/scripts/docs and remove them from package/change-impact configuration.

### Requirement: Query execution preserves authorization and least privilege
**Reason**: The dedicated Qwen analytics query boundary is being removed.
**Migration**: Revoke/drop the analytics roles, grants, views, and connection variables after zero active sessions are verified.

### Requirement: Query execution is resource-bounded
**Reason**: No Qwen analytics query executes after removal.
**Migration**: Delete the broker/compiler limits with the query runtime; retain bounds on unrelated application APIs.

### Requirement: Analytics audit evidence excludes sensitive content
**Reason**: Qwen analytics audit persistence is being deleted.
**Migration**: Delete audit rows/table/key contract without exporting sensitive content; keep only the sanitized decommission receipt.

### Requirement: Named filters have one authoritative executable definition
**Reason**: The chat semantic-query copy/registry is being removed, but ordinary dataset filters remain supported.
**Migration**: Move the null-preserving UUPG predicate to a product-neutral module with parity tests before deleting the Qwen named-filter registry.

### Requirement: Reviewed ROP classification fields are typed analytics concepts
**Reason**: ROP fields will no longer be exposed as Qwen analytics concepts.
**Migration**: Delete semantic concept definitions while preserving the typed standalone ROP projection and resource UI/API.

### Requirement: ROP relationships are registered, version-bound, grain-safe, and null-preserving
**Reason**: Qwen dataset-to-ROP analytical relationships are being removed.
**Migration**: Delete chat relationship registries and legacy chat binding state while preserving immutable resource sets used by supported pipelines.

### Requirement: Record query results declare completeness and matching scope
**Reason**: No Qwen record-query result contract remains.
**Migration**: Delete chat completeness evidence while preserving standalone dataset/resource paging and download behavior.

### Requirement: Numeric claims are bound to typed evidence and scope
**Reason**: The application will no longer generate Qwen numeric claims.
**Migration**: Delete evidence narration/validation and its incident fixtures with the chat runtime.

### Requirement: Signed prior-turn evidence supports trustworthy follow-ups
**Reason**: There are no Qwen follow-up turns after removal.
**Migration**: Delete signed turn state, its secret, continuation state, and persistent ledgers.

### Requirement: Retrieved semantics never widen deterministic query authority
**Reason**: Both semantic retrieval and Qwen deterministic querying are being removed.
**Migration**: Delete their authorization bridge while preserving existing dataset and reference-resource authorization.

### Requirement: Incident regressions are release-blocking
**Reason**: Qwen analytics incident regressions no longer represent a product capability.
**Migration**: Delete Qwen incident fixtures/evaluations and rely on the removal's absence and shared-behavior regression gates.

### Requirement: Reviewed filter regions compile through deterministic country scope
**Reason**: Qwen will no longer compile geographic analytics plans.
**Migration**: Delete chat compiler/resolver behavior while retaining canonical filter-region data and aliases required by non-chat filtering.
