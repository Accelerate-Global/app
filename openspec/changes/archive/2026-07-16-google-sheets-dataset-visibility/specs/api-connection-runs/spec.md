## ADDED Requirements

### Requirement: Google Sheets setup collects initial dataset visibility
The system SHALL ask an administrator whether datasets created from the selected Google Sheet tabs are workspace-visible, SHALL apply one choice to all tabs selected in the connection action, and SHALL default the choice to workspace-visible.

#### Scenario: Visibility choice is shown during setup
- **WHEN** an administrator checks access to a Google Sheet and selects one or more tabs for connection
- **THEN** the setup flow shows a workspace-visible dataset control
- **AND** the control explains that the choice applies to datasets created from all selected tabs
- **AND** the control is enabled by default

#### Scenario: Administrator previews a private import
- **WHEN** the administrator disables workspace visibility in the Google Sheets setup flow
- **THEN** the flow shows the red system-managed `Private` tag
- **AND** the flow states that the selected tabs will create datasets hidden from non-admin users

#### Scenario: Administrator connects multiple private tabs
- **WHEN** the administrator selects multiple tabs, disables workspace visibility, and confirms the connection
- **THEN** the system creates one connection per selected tab with private initial dataset visibility
- **AND** each connection's first successful import creates a dataset hidden from non-admin users
- **AND** each created dataset has the red system-managed `Private` tag

#### Scenario: Administrator keeps imported datasets workspace-visible
- **WHEN** the administrator leaves workspace visibility enabled and confirms the connection
- **THEN** each selected tab's connection records workspace-visible initial dataset visibility
- **AND** each connection's first successful import creates a dataset visible to non-admin users
- **AND** the system does not apply the system-managed `Private` tag

### Requirement: Google Sheets dataset visibility remains backward-compatible
The system MUST preserve the previous workspace-visible behavior for callers and connection records that do not contain an initial dataset visibility choice, and MUST NOT reapply an initial connection choice after a dataset exists.

#### Scenario: Connect request omits visibility
- **WHEN** an authorized legacy caller submits a valid Google Sheets connection request without a dataset visibility field
- **THEN** the system creates the connections with workspace-visible initial dataset visibility

#### Scenario: Legacy connection performs its first import
- **WHEN** a Google Sheets connection without a stored visibility choice completes its first successful import
- **THEN** the system creates a workspace-visible dataset

#### Scenario: Existing dataset is refreshed
- **WHEN** a Google Sheets connection refreshes a dataset that already exists
- **THEN** the system preserves the dataset's current workspace visibility
- **AND** the system preserves the corresponding system-managed `Private` tag invariant

### Requirement: Imported dataset privacy is distinct from source Sheet sharing
The Google Sheets setup flow MUST distinguish imported dataset visibility from the source Sheet sharing required for service-account access.

#### Scenario: Administrator reviews privacy guidance
- **WHEN** the setup flow displays both service-account sharing instructions and the dataset visibility choice
- **THEN** the sharing instructions describe access to the source Google Sheet
- **AND** the visibility choice describes access by non-admin users to the imported datasets
