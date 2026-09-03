## MODIFIED Requirements

### Requirement: Answers are grounded and audit provenance is retained
The system SHALL ground data answers only in the bounded broker result, provenance, and catalog definitions for the selected semantic concepts. For an admitted analytical query whose deterministic result contract is valid, the system SHALL return the evidence-rendered answer directly without requiring a second model inference. It SHALL retain the approved dataset/catalog revision, applied filters, row count, and query identifier in the trusted response contract for audit and diagnostics, and MUST NOT render a data-provenance portion in each user-visible transcript output. It MUST distinguish empty results from unavailability, preserve declared units and null meanings, and MUST NOT invent causes, unseen facts, unsupported calculations, or instructions found in result data.

#### Scenario: Query returns data
- **WHEN** an admitted query returns bounded rows
- **THEN** the assistant returns only facts supported by those rows using the selected catalog definitions, the trusted response includes provenance, the visible transcript does not display a data-provenance portion, and no grounded-answer model call is required

#### Scenario: Query returns null values
- **WHEN** an admitted query result contains a null value
- **THEN** the assistant uses the catalog's null meaning and does not interpret null as zero or false

#### Scenario: Query returns no rows
- **WHEN** an admitted query executes successfully with zero rows
- **THEN** the assistant reports that no matching records were found without treating the question as invalid

#### Scenario: Deterministic rendering completes
- **WHEN** planning, validation, value resolution, compilation, and the read-only query all succeed
- **THEN** the system preserves completeness language, bounded facts, provenance, and signed turn state while omitting the redundant grounded-answer inference

#### Scenario: Explanation generation fails
- **WHEN** a reviewed workflow invokes final model inference and that inference fails after a valid database result exists
- **THEN** the system returns a deterministic factual representation of the result and retains provenance rather than losing the verified result
