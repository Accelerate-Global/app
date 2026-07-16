## ADDED Requirements

### Requirement: Admin dataset surfaces identify restricted datasets with a Private tag

The system SHALL show a canonical red `Private` tag on admin dataset surfaces whenever a dataset is hidden from non-admin users and SHALL treat the tag as system-managed.

#### Scenario: Admin browses restricted datasets

- **WHEN** an authenticated admin views the dashboard dataset list
- **THEN** each restricted dataset row displays a red `Private` tag in its Tags column
- **AND** workspace-visible dataset rows do not display the `Private` tag

#### Scenario: Admin disables workspace visibility while editing

- **WHEN** an authenticated admin turns off the Workspace-visible dataset control
- **THEN** the Tags section immediately displays the red `Private` tag
- **AND** the existing hidden-from-non-admin explanatory message remains visible

#### Scenario: Admin enables workspace visibility while editing

- **WHEN** an authenticated admin turns on the Workspace-visible dataset control
- **THEN** the `Private` tag immediately disappears from the Tags section

#### Scenario: Admin manages ordinary dataset tags

- **WHEN** an authenticated admin creates, reuses, edits, or removes dataset tags
- **THEN** `Private` is unavailable as a freeform or reusable tag
- **AND** the admin cannot recolor, rename, duplicate, or remove the visibility-managed `Private` tag independently of the workspace visibility control
