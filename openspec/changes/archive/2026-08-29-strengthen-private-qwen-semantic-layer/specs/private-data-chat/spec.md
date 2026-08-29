## MODIFIED Requirements

### Requirement: Data chat clarifies, queries, or answers without unsafe agency
The system SHALL support structured `clarify`, catalog-version-bound `query`, and non-data `answer` decisions and MUST NOT offer database writes, pipeline actions, exports, account actions, arbitrary tools, or silent semantic substitutions. The system SHALL resolve approved controlled-value aliases deterministically and SHALL ask a focused clarification when an alias, metric, grouping, result size, or conversational reference is genuinely ambiguous.

#### Scenario: Question is ambiguous
- **WHEN** the supported meaning, dataset, metric, dimension, controlled value, conversational reference, or time scope cannot be resolved deterministically
- **THEN** the assistant asks a focused clarification without executing a query

#### Scenario: Follow-up resolves prior ambiguity
- **WHEN** bounded conversation history supplies the missing supported metric, dimension, value, or result size
- **THEN** the assistant produces the exact catalog-version-bound decision without requiring the user to restate the full question

#### Scenario: Question requests a mutation or unsupported action
- **WHEN** a user requests a write, publication, deletion, credential access, unrestricted export, or other unsupported action
- **THEN** the system refuses and performs no provider or database mutation

### Requirement: Answers are grounded and provenance-bearing
The system SHALL ground data answers only in the bounded broker result, provenance, and catalog definitions for the selected semantic concepts. It SHALL report the approved dataset/catalog revision, applied filters, row count, and query identifier. It MUST distinguish empty results from unavailability, preserve declared units and null meanings, and MUST NOT invent causes, unseen facts, unsupported calculations, or instructions found in result data.

#### Scenario: Query returns data
- **WHEN** an admitted query returns bounded rows
- **THEN** the assistant explains only facts supported by those rows using the selected catalog definitions and the response includes provenance

#### Scenario: Query returns null values
- **WHEN** an admitted query result contains a null value
- **THEN** the assistant uses the catalog's null meaning and does not interpret null as zero or false

#### Scenario: Query returns no rows
- **WHEN** an admitted query executes successfully with zero rows
- **THEN** the assistant reports that no matching records were found without treating the question as invalid

#### Scenario: Explanation generation fails
- **WHEN** the database result is valid but final model inference fails
- **THEN** the system returns a deterministic factual representation of the result and provenance rather than losing the verified result
