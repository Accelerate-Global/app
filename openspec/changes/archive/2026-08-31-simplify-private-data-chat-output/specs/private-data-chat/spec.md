## ADDED Requirements

### Requirement: Chat composer remains accessible without redundant visible instruction
The system SHALL present the data-chat question input without the visible statement `Ask about approved data` and MUST retain a programmatic accessible name that describes the input's purpose.

#### Scenario: Pilot administrator opens the question composer
- **WHEN** the private data chat is available
- **THEN** the question textarea is accessible by the name `Question for Qwen` and the statement `Ask about approved data` is not visibly rendered

## MODIFIED Requirements

### Requirement: Answers are grounded and audit provenance is retained
The system SHALL ground data answers only in the bounded broker result, provenance, and catalog definitions for the selected semantic concepts. It SHALL retain the approved dataset/catalog revision, applied filters, row count, and query identifier in the trusted response contract for audit and diagnostics, and MUST NOT render a data-provenance portion in each user-visible transcript output. It MUST distinguish empty results from unavailability, preserve declared units and null meanings, and MUST NOT invent causes, unseen facts, unsupported calculations, or instructions found in result data.

#### Scenario: Query returns data
- **WHEN** an admitted query returns bounded rows
- **THEN** the assistant explains only facts supported by those rows using the selected catalog definitions, the trusted response includes provenance, and the visible transcript does not display a data-provenance portion

#### Scenario: Query returns null values
- **WHEN** an admitted query result contains a null value
- **THEN** the assistant uses the catalog's null meaning and does not interpret null as zero or false

#### Scenario: Query returns no rows
- **WHEN** an admitted query executes successfully with zero rows
- **THEN** the assistant reports that no matching records were found without treating the question as invalid

#### Scenario: Explanation generation fails
- **WHEN** the database result is valid but final model inference fails
- **THEN** the system returns a deterministic factual representation of the result and retains provenance in the trusted response rather than losing the verified result
