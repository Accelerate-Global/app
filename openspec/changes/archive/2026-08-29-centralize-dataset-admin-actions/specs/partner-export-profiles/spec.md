## MODIFIED Requirements

### Requirement: Partner export management begins from a compact dataset action

The system SHALL expose Partner exports inside one administrator-only Dataset actions menu on the dataset page instead of rendering a standalone export button or expanded export-management card. Selecting Partner exports SHALL open a slide-out that explains the workflow and exposes the current dataset's profile, preview, run, download, and new-profile entry behavior before the administrator enters the existing profile editor.

#### Scenario: Administrator opens partner export management

- **WHEN** a dataset administrator opens a source dataset and opens Dataset actions
- **THEN** the menu displays Partner exports
- **AND** selecting it opens an accessible export-management slide-out for that dataset
- **AND** no standalone Partner exports button or expanded profile details appear on the page

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
- **THEN** Dataset actions, Partner exports, and export-management details are not rendered
- **AND** existing server authorization continues to deny partner-export access
