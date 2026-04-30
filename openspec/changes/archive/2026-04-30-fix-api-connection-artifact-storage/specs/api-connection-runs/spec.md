## ADDED Requirements

### Requirement: API connection run artifacts use isolated JSON storage
The system SHALL archive successful API connection run JSON artifacts in a private Storage bucket dedicated to API connection artifacts, while preserving admin download compatibility for artifacts previously stored in the legacy dataset bucket.

#### Scenario: Successful run archives JSON artifacts in artifact storage
- **WHEN** a saved API connection run succeeds and output artifacts are archived
- **THEN** the system uploads the normalized rows artifact and redacted raw response artifact to the API connection artifact bucket using `application/json` content type

#### Scenario: Admin downloads a legacy output artifact
- **WHEN** a dataset admin downloads a run output whose stored object path exists only in the legacy dataset bucket
- **THEN** the system returns the same JSON or CSV download response as it would for an artifact stored in the dedicated artifact bucket

#### Scenario: Dataset CSV uploads remain isolated
- **WHEN** a dataset admin requests a signed upload for a CSV dataset file
- **THEN** the system continues to use the dataset Storage bucket and CSV upload restrictions without allowing direct CSV upload access to the API connection artifact bucket
