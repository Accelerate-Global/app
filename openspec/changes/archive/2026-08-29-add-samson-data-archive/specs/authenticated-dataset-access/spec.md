## ADDED Requirements

### Requirement: Dataset-version cold state fails closed until separately enabled
The system SHALL keep dataset-version payloads hot in the initial archive rollout and SHALL fail closed if catalog metadata identifies a version as cold. A separately released operator workflow MAY later enable cold transition only after it can restore verified rows and objects before revert, download, or row access.

#### Scenario: Admin views a cold dataset version
- **WHEN** a dataset administrator views version history containing a cold version
- **THEN** the history identifies the version, creation metadata, checksum, row count, and cold state
- **AND** explains that operator rehydration is required before use

#### Scenario: Admin attempts to revert a cold version
- **WHEN** a dataset administrator requests normal version revert while the selected version remains cold
- **THEN** the revert does not change current dataset rows
- **AND** returns a stable rehydration-required outcome

#### Scenario: Rehydrated version is reverted after future enablement
- **WHEN** a separately released operator workflow has restored and verified a cold version into collision-free hot identities and an administrator submits a valid revert
- **THEN** the existing admin-only version and dataset-integrity controls apply
- **AND** the immutable cold package remains unchanged

#### Scenario: Viewer requests cold version content
- **WHEN** an unauthenticated or non-admin user requests cold version rows, objects, or archive metadata
- **THEN** the request is denied under the existing dataset-access boundary
