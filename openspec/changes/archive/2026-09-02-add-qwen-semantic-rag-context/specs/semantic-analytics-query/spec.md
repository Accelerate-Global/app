## ADDED Requirements

### Requirement: Named filters have one authoritative executable definition
The system SHALL maintain each approved named filter as a versioned typed expression owned by application code and SHALL use that same definition for table-row evaluation, trusted current-view context, semantic explanation, typed plans, and deterministic SQL compilation. Qwen MUST reference only an approved named-filter key and validated options and MUST NOT generate arbitrary boolean expression trees.

#### Scenario: UUPG uses its default active criteria
- **WHEN** the UUPG named filter enables global-engagement and frontier-group criteria
- **THEN** both table and SQL execution apply `(global engagement is false or blank) AND (frontier group is true or blank)` exactly

#### Scenario: UUPG blank behavior is explained
- **WHEN** the filter is rendered or supplied as semantic context
- **THEN** it explains that blank values are retained because they do not record the disqualifying opposite state, identifies the view as null-preserving, and does not claim that a blank is an affirmative classification or the same rule as the Baseline UUPG pipeline

#### Scenario: One UUPG criterion is disabled
- **WHEN** validated current-view state disables one supported UUPG criterion
- **THEN** table evaluation, planner context, description, and SQL compilation apply only the remaining active branch

#### Scenario: Table and compiler evaluate the same fixture
- **WHEN** explicit true/false and blank combinations are evaluated through both implementations
- **THEN** the matching record identities and counts are identical

#### Scenario: Plan names an unknown or stale filter
- **WHEN** a plan or view context cites an unknown named-filter key, invalid option, or stale registry checksum
- **THEN** validation fails before database access

### Requirement: Reviewed ROP classification fields are typed analytics concepts
The approved primary people-group analytics projection SHALL expose a normalized six-digit `rop3_code` and the query catalog SHALL expose reviewed semantic concepts for ROP1, ROP2, ROP25, and ROP3 code/name plus ROP3 status, place, language, source, and join/match status. Approved hierarchy code/name concepts MAY be selected, filtered, grouped, and sorted through the typed plan. User-supplied ROP names/codes MUST be deterministically resolved to canonical values before parameterized compilation. ROP descriptions SHALL remain explanatory/resource-detail evidence unless separately promoted as typed query concepts.

#### Scenario: User filters by a ROP hierarchy term
- **WHEN** a user asks for people groups in an approved ROP1, ROP2, ROP25, or ROP3 classification using a canonical code or unambiguous name
- **THEN** deterministic resolution supplies the canonical code and the compiler emits only the registered parameterized predicate

#### Scenario: User groups by a reviewed ROP level
- **WHEN** a typed plan selects an approved ROP hierarchy code/name as its grouping dimension
- **THEN** execution preserves the primary people-group grain before grouping and returns the reviewed label/code with typed completeness and evidence metadata

#### Scenario: ROP name is ambiguous
- **WHEN** deterministic resolution finds multiple permitted canonical terms for the supplied name
- **THEN** no analytics query executes until the user selects from a bounded ambiguity response

#### Scenario: Plan cites an unreviewed ROP attribute
- **WHEN** a plan requests a source column, description, or attribute absent from the query catalog
- **THEN** validation rejects it before compilation even when a retrieved resource entry contains that attribute

### Requirement: ROP relationships are registered, version-bound, grain-safe, and null-preserving
Combining primary people-group data with ROP SHALL use only the server-owned `people_group_to_bound_rop3` relationship. The relationship registry MUST own its physical projection, normalized key mapping, selected columns, many-to-one cardinality, and deterministic left-relationship compilation. Execution MUST resolve the exact immutable `rop-codes` version bound to the dataset producer/forming run through its reference-resource set. For an independently reviewed dataset version that predates publication lineage, execution MAY instead use one exact private append-only legacy binding to a complete valid ROP version, but only when no producer publication exists for that dataset. Runtime resolution MUST never derive that legacy binding from the active pointer and MUST fail closed if neither binding can be proven. Qwen MUST NOT emit physical tables, join keys, join types, or `ON` expressions.

#### Scenario: Dataset has an immutable ROP resource binding
- **WHEN** an approved ROP concept is selected for a primary dataset whose production lineage resolves one exact ROP version
- **THEN** the compiler uses `people_group_to_bound_rop3` with that version and does not consult the current active ROP pointer

#### Scenario: Reviewed pre-publication dataset has an explicit legacy binding
- **WHEN** the exact current dataset version predates publication lineage and a private append-only review record pins one complete valid ROP version
- **THEN** the compiler uses that exact version without consulting or mutating the active pointer, and the legacy binding exposes no direct application, provider, or analytics-role grants

#### Scenario: Producer publication supersedes a legacy path
- **WHEN** producer publication exists for a dataset that also has a historical legacy binding record
- **THEN** resolution uses only producer resource-set lineage and does not fall back to the legacy record

#### Scenario: Active ROP version has advanced
- **WHEN** standalone browsing uses a newer active ROP version than the version bound to the dataset
- **THEN** standalone results label the active version while dataset filters/relationships continue to use the immutable bound version

#### Scenario: Dataset ROP binding is absent or ambiguous
- **WHEN** producer/forming-run lineage cannot prove one exact ROP resource version and no eligible exact reviewed legacy binding exists
- **THEN** ROP analytics fails closed with a bounded explanation and no relationship or fallback-to-active-version query executes

#### Scenario: Dataset ROP3 is blank, malformed, inactive, or unmatched
- **WHEN** an unfiltered result uses the registered ROP relationship
- **THEN** the base people-group row remains present, its classification values remain null as appropriate, and typed match/join status explains the condition without Qwen inventing a replacement

#### Scenario: User explicitly filters on a ROP classification
- **WHEN** an approved ROP predicate is applied
- **THEN** nonmatching or null-classification rows are excluded only according to that stated predicate and the answer identifies the resulting filter scope

#### Scenario: User filters primary data by ROP geography
- **WHEN** an approved geography predicate is requested
- **THEN** the compiler uses a registered `EXISTS`-style predicate against the bound ROP version so the people-group grain and counts are not multiplied

#### Scenario: User names a country in a ROP geography filter
- **WHEN** the value is not an exact stored ROP geography value but uniquely matches a reviewed country name or alias
- **THEN** deterministic application code resolves it to a canonical country code present in the reviewed ROP resource, records both resource versions, and compiles only the parameterized grain-preserving predicate

#### Scenario: User requests ROP geography rows
- **WHEN** the request requires listing one-to-many ROP3 geography records
- **THEN** execution returns the dedicated `rop_geography` result grain rather than flattening geography rows into a people-group aggregate

#### Scenario: Model proposes a join expression or unregistered relationship
- **WHEN** model output includes physical keys, an `ON` condition, direct geography flattening, or a relationship key absent from the active registry
- **THEN** schema validation or compilation rejects it before database access

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

## MODIFIED Requirements

### Requirement: SQL compilation is deterministic and parameterized
The system SHALL compile validated, catalog-version-bound plans using only trusted identifier mappings and MUST supply every user/model value as an out-of-line positional parameter. The compiler SHALL enforce one read-only `SELECT`, bounded approved aggregations and sorts, no arbitrary joins, only independently registered version-bound relationships, and a maximum result limit. Controlled value aliases SHALL be resolved deterministically against an approved active reference resource before compilation; ambiguous aliases MUST clarify without querying, while unknown values SHALL remain complete inert parameters that may produce an empty result.

#### Scenario: Plan uses an independently registered relationship
- **WHEN** a validated plan requests the active catalog's `people_group_to_bound_rop3` relationship
- **THEN** the compiler may emit only that registry-owned, immutable-version-bound relationship and its parameterized predicates
