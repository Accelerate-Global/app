## ADDED Requirements

### Requirement: Partner export management begins from a compact dataset action

The system SHALL render one administrator-only Partner exports action on the dataset page instead of an expanded export-management card. Activating the action SHALL open a slide-out that explains the workflow and exposes the current dataset's profile, preview, run, download, and new-profile entry behavior before the administrator enters the existing profile editor.

#### Scenario: Administrator opens partner export management

- **WHEN** a dataset administrator opens a source dataset
- **THEN** the page displays one Partner exports button without expanded profile details
- **AND** activating the button opens an accessible export-management slide-out for that dataset

#### Scenario: Administrator begins a new profile

- **WHEN** the administrator selects New export profile from the export-management slide-out
- **THEN** the management slide-out hands off to the existing wide profile editor without leaving two active modal surfaces
- **AND** closing or saving the editor returns the administrator to export management

#### Scenario: Administrator reviews existing export activity

- **WHEN** the administrator opens export management for a dataset with saved profiles or runs
- **THEN** the slide-out exposes the existing preview, generation, status, and authorized artifact-download behavior
- **AND** the source dataset and export API behavior remain unchanged

#### Scenario: Non-admin opens a dataset

- **WHEN** an authenticated non-admin opens a dataset they may read
- **THEN** the Partner exports action and its management details are not rendered
- **AND** existing server authorization continues to deny partner-export access
