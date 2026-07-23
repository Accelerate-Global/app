## ADDED Requirements

### Requirement: Engine-managed imports stage rather than directly publish
The system SHALL archive successful import artifacts for every connection with an active registered forming profile and SHALL require an explicit valid candidate publication before changing its curated dataset target.

#### Scenario: Engine-managed import succeeds
- **WHEN** a registered Tier 1 profile completes an import
- **THEN** the run succeeds with checksummed raw and parsed artifacts and forming eligibility
- **AND** does not expose the parsed source rows as the curated workspace dataset

#### Scenario: Unregistered import succeeds
- **WHEN** an import has no active forming profile
- **THEN** its existing provider-specific direct import behavior remains unchanged
