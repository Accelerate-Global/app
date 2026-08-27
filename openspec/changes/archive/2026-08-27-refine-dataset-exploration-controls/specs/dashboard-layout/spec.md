## ADDED Requirements

### Requirement: Dataset filter context precedes the controls that shape it

The system SHALL place the Current filtered table summary and its available actions immediately above the Filters panel on desktop dataset-detail layouts. The summary SHALL fit the established filter-column width without horizontal overflow, and the same single control instance SHALL remain available above dataset content on narrower layouts where Filters open in a slide-out.

#### Scenario: User explores a dataset on desktop

- **WHEN** an authenticated user opens dataset detail at the desktop filter-sidebar breakpoint
- **THEN** Current filtered table appears directly above Filters in the left column
- **AND** the Table or Map content remains in the wider right column

#### Scenario: Filtered-table actions fit the sidebar

- **WHEN** the user's role exposes download, save, or assign actions in the desktop left column
- **THEN** every available action remains readable and operable without horizontal overflow
- **AND** omitted role-specific actions do not leave unusable layout gaps

#### Scenario: User explores a dataset on a narrow viewport

- **WHEN** the desktop Filters panel is replaced by its slide-out trigger
- **THEN** Current filtered table remains visible above the Table or Map content
- **AND** its Filters trigger and permitted table actions remain keyboard-operable without duplicating the control group
