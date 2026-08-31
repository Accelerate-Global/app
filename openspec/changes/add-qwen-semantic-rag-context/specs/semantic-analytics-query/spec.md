## ADDED Requirements

### Requirement: Named filters have one authoritative executable definition
The system SHALL maintain each approved named filter as a versioned typed expression owned by application code and SHALL use that same definition for table-row evaluation, trusted current-view context, semantic explanation, typed plans, and deterministic SQL compilation. Qwen MUST reference only an approved named-filter key and validated options and MUST NOT generate arbitrary boolean expression trees.

#### Scenario: UUPG uses its default active criteria
- **WHEN** the UUPG named filter enables global-engagement and frontier-group criteria
- **THEN** both table and SQL execution apply `(global engagement is false or blank) AND (frontier group is true or blank)` exactly

#### Scenario: One UUPG criterion is disabled
- **WHEN** validated current-view state disables one supported UUPG criterion
- **THEN** table evaluation, planner context, description, and SQL compilation apply only the remaining active branch

#### Scenario: Table and compiler evaluate the same fixture
- **WHEN** explicit true/false and blank combinations are evaluated through both implementations
- **THEN** the matching record identities and counts are identical

#### Scenario: Plan names an unknown or stale filter
- **WHEN** a plan or view context cites an unknown named-filter key, invalid option, or stale registry checksum
- **THEN** validation fails before database access

### Requirement: Record query results declare completeness and matching scope
Every executed record query SHALL return its query mode, requested limit, returned count, matching count, `hasMore` status, selected concepts, applied named-filter keys, dataset/version identity, and bounded rows. Internal matching-count fields MUST be removed before rows are exposed to Qwen or the browser.

#### Scenario: More records match than the approved limit
- **WHEN** 103 records match and the requested/approved limit is 100
- **THEN** the result reports `matchedCount=103`, `returnedCount=100`, and `hasMore=true`

#### Scenario: All matching records fit within the limit
- **WHEN** the matching count is less than or equal to the requested limit
- **THEN** the result reports the exact matching and returned counts with `hasMore=false`

#### Scenario: Completeness values disagree
- **WHEN** returned count exceeds the limit, matching count is smaller than returned count, or `hasMore` conflicts with the counts
- **THEN** the broker rejects the result and emits no complete answer

### Requirement: Numeric claims are bound to typed evidence and scope
The system SHALL construct a typed evidence ledger from validated aggregate cells, record cells, matching/returned counts, units, null meanings, and query scope. User-visible numeric facts MUST be rendered from validated evidence references rather than model-authored value strings. Unknown, altered, unit-incompatible, or scope-incompatible evidence references MUST trigger deterministic fallback.

#### Scenario: Bounded page is narrated
- **WHEN** a record result returns 100 of 103 matching records
- **THEN** the authoritative response states that 103 match and 100 are shown and MUST NOT state that the total is 100

#### Scenario: Scalar count is narrated
- **WHEN** an aggregate returns `people_group_count=103`
- **THEN** the rendered fact uses exactly 103 people groups with the approved unit

#### Scenario: Qwen changes a value or scope
- **WHEN** Qwen cites returned-count evidence as a matching total or supplies a different literal/unit
- **THEN** the narrative is discarded and the deterministic grounded response is returned

### Requirement: Signed prior-turn evidence supports trustworthy follow-ups
The system SHALL issue bounded signed turn-state evidence for completed plans/results and SHALL verify identity/session binding, expiry, catalog/filter/snapshot versions, result checksum, and evidence scope before using it in a later turn. Client-supplied assistant prose MUST NOT be treated as trusted prior-query evidence.

#### Scenario: User challenges a prior count
- **WHEN** a follow-up asks why a returned page differs from a prior matching count and supplies valid signed turn evidence
- **THEN** the planner/narrator can distinguish prior aggregate totals from record-page bounds without relying on assistant prose

#### Scenario: Client forges prior result text or state
- **WHEN** assistant prose or a turn token claims an unverified count, field, or dataset
- **THEN** the server ignores the untrusted claim or rejects the token and performs no query based on it

### Requirement: Retrieved semantics never widen deterministic query authority
The planner MAY receive relevant reviewed semantic cards, named-filter descriptions, deterministic resolver outputs, typed dependencies, and up to two reviewed semantic-plan examples, but the typed schema, active query catalog, named-filter registry, controlled-value resolvers, and compiler SHALL remain the only sources of executable query authority. Retrieved examples MUST NOT contain SQL or compiler mappings.

#### Scenario: Retrieval explains an unavailable concept
- **WHEN** an explanatory-only entry is relevant but absent from the query catalog
- **THEN** Qwen may explain the concept or limitation but cannot compile it into SQL

#### Scenario: Retrieval suggests a physical field or relationship
- **WHEN** retrieved metadata contains a source column, mapping, or relationship not approved for chat
- **THEN** the plan and compiler reject it before database access

#### Scenario: Retrieved example is stale or over-broad
- **WHEN** an example cites a stale catalog/filter version or a concept/operator unavailable to the current query catalog
- **THEN** it is excluded before planning and cannot authorize that plan shape

### Requirement: Incident regressions are release-blocking
The semantic evaluation suite SHALL cover the exact country-count, frontier-count, capped-record-list, count-challenge, and UUPG-view sequence that produced the 100/103/104 disagreement. It SHALL also cover every explicit/blank UUPG input combination and require table/SQL parity, completeness wording, and deterministic evidence fallback.

#### Scenario: Exact Sudan-style regression fixture runs
- **WHEN** a fixture contains 103 frontier matches, 104 UUPG matches, and a 100-row record limit
- **THEN** aggregate, named-filter, and record-page answers remain distinct and no response promotes 100 returned rows to a total

#### Scenario: Planner or answer contract changes
- **WHEN** result shape, named-filter registry, retrieval policy, evidence schema, prompt, or model changes
- **THEN** the full approved deterministic suite and pinned live-Qwen repetitions must pass before release
