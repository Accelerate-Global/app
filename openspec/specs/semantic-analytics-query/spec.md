# semantic-analytics-query Specification

## Purpose
Define the approved semantic catalog, typed model-plan contract, deterministic
SQL compiler, authorization-preserving analytics role, resource limits, and
privacy-preserving audit evidence for private data chat.

## Requirements

### Requirement: Analytics uses a versioned approved semantic catalog
The system SHALL define each queryable dataset, metric, dimension, filter, operator, join, sort, and synonym in a versioned server-owned catalog. The pilot MUST query only the approved current primary people-groups projection and MUST NOT expose arbitrary uploaded columns.

#### Scenario: Supported people-groups concept is requested
- **WHEN** a query plan names an approved catalog concept
- **THEN** the system resolves it to the exact versioned dataset and trusted database expression

#### Scenario: Unknown concept or dataset is requested
- **WHEN** a plan contains an identifier absent from the active catalog revision
- **THEN** the system rejects the plan before SQL compilation or database access

### Requirement: Qwen returns structured plans rather than SQL
The system SHALL constrain model planning to a strict schema containing a decision and typed catalog values. Model output MUST NOT contain executable SQL, relation names, SQL fragments, database credentials, or authorization scope.

#### Scenario: Valid query plan is returned
- **WHEN** Qwen selects approved metrics, dimensions, filters, sorting, and limit using the required schema
- **THEN** the server validates the plan and passes it to the deterministic compiler

#### Scenario: Model returns malformed or forbidden content
- **WHEN** Qwen returns invalid JSON, an unsupported field, SQL text, or a value outside the schema
- **THEN** the system fails closed and permits at most one bounded repair or clarification

### Requirement: SQL compilation is deterministic and parameterized
The system SHALL compile validated plans using only trusted identifier mappings and MUST supply every user/model value as an out-of-line positional parameter. The compiler SHALL enforce one read-only `SELECT`, bounded joins/aggregations/sorts, and a maximum result limit.

#### Scenario: Filter contains adversarial text
- **WHEN** a filter value contains quotes, comments, SQL keywords, Unicode, or statement delimiters
- **THEN** the SQL template remains unchanged and the complete value is supplied only as a parameter

#### Scenario: Plan exceeds policy limits
- **WHEN** a plan exceeds approved dimensions, filters, joins, sorts, or result limits
- **THEN** compilation fails before database access

### Requirement: Query execution preserves authorization and least privilege
The system SHALL execute admitted queries through a dedicated non-bypass read-only role over an approved security-invoker analytical view while propagating the server-verified user identity and trusted workspace role transaction-locally. The view SHALL use a locked-search-path, no-argument projection entrypoint that independently verifies `auth.uid()` and the trusted pilot role. The analytics role MUST NOT receive direct public/auth table privileges, and the resulting dataset-access outcome MUST remain at least as restrictive as the existing pilot authorization rules.

#### Scenario: User may access the source dataset
- **WHEN** the verified identity is authorized by existing dataset visibility and RLS rules
- **THEN** the broker may return only rows visible to that identity

#### Scenario: User may not access the source dataset
- **WHEN** the source dataset is restricted from the verified identity
- **THEN** the database returns no unauthorized rows and the broker cannot bypass the restriction

#### Scenario: Broker role attempts a write or unauthorized relation
- **WHEN** the analytics credential attempts DML, DDL, an unsafe function, or a non-approved relation
- **THEN** PostgreSQL rejects the operation through grants, read-only transaction settings, or admission policy

### Requirement: Query execution is resource-bounded
The system SHALL enforce statement, lock, idle-transaction, work-memory, estimated-cost, row-count, response-byte, connection, and concurrency limits. All parse, policy, timeout, and limit errors MUST fail closed.

#### Scenario: Query exceeds cost or time budget
- **WHEN** an admitted template has excessive estimated cost or exceeds the execution deadline
- **THEN** the broker cancels or rejects it and returns no partial rows as a complete result

#### Scenario: Result exceeds row or byte limit
- **WHEN** execution produces more than the permitted rows or serialized bytes
- **THEN** the broker rejects the result or reports it as truncated only through an explicit bounded contract

### Requirement: Analytics audit evidence excludes sensitive content
The system SHALL record query identifier, pseudonymous identity/session reference, policy/catalog/model/runtime hashes, decision, stable reason, referenced view, parameterized redacted template, timing, row count, and byte count. It MUST NOT store raw prompts, parameter values, result rows, provider credentials, or raw provider errors.

#### Scenario: Query completes or fails
- **WHEN** the broker reaches an admission or execution decision
- **THEN** it appends a redacted audit event sufficient to reproduce policy and performance without retaining sensitive content
