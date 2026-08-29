## MODIFIED Requirements

### Requirement: Analytics uses a versioned approved semantic catalog
The system SHALL define each queryable dataset, dataset grain, metric, dimension, record field, filter, operator, join capability, sort, alias, value type, unit, null meaning, value-domain policy, relationship, sensitivity, provenance, and freshness rule in a versioned server-owned catalog. The catalog revision SHALL be checksum-bound, and model plans, compilation, provenance, deterministic fixtures, and release evidence MUST agree on that exact revision. The pilot MUST query only the approved current primary people-groups projection and MUST NOT expose arbitrary uploaded columns or automatically expose a field merely because it exists in mutable field-definition metadata.

#### Scenario: Supported people-groups concept is requested
- **WHEN** a query plan names an approved catalog concept and exact active catalog revision
- **THEN** the system resolves it to the exact versioned dataset and trusted database expression

#### Scenario: Unknown concept, dataset, or stale catalog is requested
- **WHEN** a plan contains an identifier absent from the active catalog revision or echoes a different catalog revision
- **THEN** the system rejects the plan before SQL compilation or database access

#### Scenario: Mutable metadata adds a field
- **WHEN** a field definition, uploaded column, or source contract exists outside the approved catalog allowlist
- **THEN** it is not exposed to Qwen and cannot be queried until a reviewed catalog revision explicitly admits it

### Requirement: Qwen returns structured plans rather than SQL
The system SHALL constrain model planning to a strict schema containing a decision, exact catalog revision, and typed catalog values. The planner SHALL receive a compact catalog-derived context containing approved business meanings, aliases, types, units, null behavior, value-domain policy, metric formulas, and compatibility rules. Model input and output MUST NOT contain executable SQL, physical relation or column names, SQL fragments, database credentials, authorization scope, unrestricted database values, or arbitrary tools.

#### Scenario: Valid query plan is returned
- **WHEN** Qwen selects approved metrics, dimensions, filters, sorting, and limit using the required schema and active catalog revision
- **THEN** the server validates the plan, resolves controlled values, and passes it to the deterministic compiler

#### Scenario: Model returns malformed, stale, or forbidden content
- **WHEN** Qwen returns invalid JSON, a stale catalog revision, an unsupported field, SQL text, or a value outside the typed schema
- **THEN** the system fails closed and permits at most one bounded repair or clarification

#### Scenario: Planner needs semantic meaning
- **WHEN** Qwen interprets an approved business question
- **THEN** it can distinguish the approved concepts from their catalog definitions and aliases without seeing compiler-only mappings or raw database values

### Requirement: SQL compilation is deterministic and parameterized
The system SHALL compile validated, catalog-version-bound plans using only trusted identifier mappings and MUST supply every user/model value as an out-of-line positional parameter. The compiler SHALL enforce one read-only `SELECT`, bounded approved aggregations and sorts, no joins for the single-dataset pilot, and a maximum result limit. Controlled value aliases SHALL be resolved deterministically against an approved active reference resource before compilation; ambiguous aliases MUST clarify without querying, while unknown values SHALL remain complete inert parameters that may produce an empty result.

#### Scenario: Filter contains adversarial text
- **WHEN** a filter value contains quotes, comments, SQL keywords, Unicode, statement delimiters, or prompt instructions
- **THEN** the SQL template remains unchanged and the complete value is supplied only as a parameter

#### Scenario: Country alias has one approved match
- **WHEN** a country filter exactly matches one active approved name, alias, or code under the declared normalization policy
- **THEN** the compiler receives the canonical country display name and reference-resource lineage without exposing the reference payload to Qwen

#### Scenario: Country alias is ambiguous
- **WHEN** a normalized country filter matches more than one active approved country entry
- **THEN** the system asks which country was intended and performs no database query

#### Scenario: Country value is unknown
- **WHEN** a country filter has no active approved alias match
- **THEN** the full value remains an inert parameter and the valid bounded query may return zero rows

#### Scenario: Plan exceeds policy limits
- **WHEN** a plan exceeds approved dimensions, filters, joins, sorts, or result limits
- **THEN** compilation fails before database access

## ADDED Requirements

### Requirement: Semantic metadata reuses trusted Accelerate Global vocabulary without widening access
The system SHALL associate approved catalog entries with existing canonical field-definition keys, source-contract fields and versions, or versioned reference-resource keys where applicable. A reviewed catalog overlay SHALL remain authoritative for queryability, metric formulas, units, null semantics, sensitivity, and allowed operations. Runtime mutable metadata MUST NOT directly alter prompts, schemas, compiler mappings, or authorization.

#### Scenario: Source metadata agrees with the catalog
- **WHEN** a catalog field cites an existing source-contract field or canonical field-definition key
- **THEN** automated reconciliation verifies compatible identity and type while retaining the catalog allowlist

#### Scenario: Source metadata drifts
- **WHEN** a cited contract field disappears or its type becomes incompatible
- **THEN** deterministic verification fails and the catalog cannot be released silently

### Requirement: Semantic regression evaluation is release-blocking
The system SHALL maintain sanitized golden cases covering supported, ambiguous, unsupported, adversarial, multi-turn, value-alias, null/boundary, authorization, and prompt-injection behavior. Golden query decisions MUST validate and compile to the expected selected concepts and positional parameters. A prompt, schema, catalog, compiler-policy, model, runtime, or fixture change MUST produce a fresh pinned live-Qwen receipt before release.

#### Scenario: Deterministic repository verification runs
- **WHEN** the semantic evaluation suite executes without Samson
- **THEN** every golden case is unique, schema-valid, catalog-current, and either compiles safely or yields the expected clarification/refusal without network access

#### Scenario: AI contract changes
- **WHEN** a release changes any pinned semantic planning or answer contract
- **THEN** the exact candidate is evaluated repeatedly against the pinned local Qwen model and release is blocked without a passing hash-verified receipt
