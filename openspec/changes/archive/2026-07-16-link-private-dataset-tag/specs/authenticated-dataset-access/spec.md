## ADDED Requirements

### Requirement: Restricted dataset metadata carries a synchronized Private tag

The system MUST store exactly one canonical red `Private` tag on dataset metadata when the dataset is hidden from non-admin users and MUST store no `Private` tag when the dataset is workspace-visible. Workspace visibility MUST remain the authorization source of truth.

#### Scenario: Admin hides a workspace-visible dataset

- **WHEN** an authenticated admin disables workspace visibility for a dataset
- **THEN** the dataset becomes inaccessible to non-admin users under the existing access rules
- **AND** its metadata contains exactly one canonical red `Private` tag

#### Scenario: Admin makes a restricted dataset workspace-visible

- **WHEN** an authenticated admin enables workspace visibility for a restricted dataset
- **THEN** the dataset becomes accessible to authenticated non-admin workspace users under the existing access rules
- **AND** its metadata contains no `Private` tag

#### Scenario: A writer submits inconsistent visibility and tag metadata

- **WHEN** an application or database writer stores dataset metadata whose `Private` tags disagree with workspace visibility
- **THEN** the persisted tags are canonicalized to match workspace visibility
- **AND** duplicate, differently colored, or case-variant `Private` tags do not remain

#### Scenario: Existing restricted datasets are migrated

- **WHEN** the visibility-linked tag behavior is deployed
- **THEN** every existing dataset hidden from non-admin users receives the canonical red `Private` tag
- **AND** existing classification and user-managed tags are preserved

#### Scenario: Non-admin requests a restricted dataset

- **WHEN** an authenticated non-admin user requests a restricted dataset after the tag is added
- **THEN** the existing not-found access response is preserved
- **AND** the `Private` tag does not disclose the dataset to that user
