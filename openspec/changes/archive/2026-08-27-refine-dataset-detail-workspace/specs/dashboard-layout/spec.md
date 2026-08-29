## MODIFIED Requirements

### Requirement: Dataset filter context precedes the controls that shape it

The system SHALL combine the Current filtered table summary, its available actions, and the Filters panel into one cohesive soft-surface component on desktop dataset-detail layouts. The combined component SHALL fit the established filter-column width without horizontal overflow, while the same single summary/action control instance SHALL remain available above dataset content on narrower layouts where Filters open in a slide-out. The Table data surface SHALL use the same semantic soft background treatment and SHALL align its default desktop viewport height with the combined left-column component.

#### Scenario: User explores a dataset on desktop

- **WHEN** an authenticated user opens dataset detail at the desktop filter-sidebar breakpoint
- **THEN** Current filtered table and Filters appear within one left-column component
- **AND** the Table or Map content remains in the wider right column
- **AND** the default Table viewport aligns with the combined left-column component height

#### Scenario: Filtered-table actions fit the sidebar

- **WHEN** the user's role exposes download, save, or assign actions in the desktop left column
- **THEN** every available action remains readable and operable without horizontal overflow
- **AND** omitted role-specific actions do not leave unusable layout gaps

#### Scenario: Table uses the surrounding component surface

- **WHEN** the user views dataset rows in Table mode in light or dark appearance
- **THEN** the table header, rows, pinned cells, and loading or empty surface use semantic soft colors consistent with the Current filtered table and Filters component
- **AND** borders, hover states, selection states, and readable text contrast remain visible

#### Scenario: User explores a dataset on a narrow viewport

- **WHEN** the desktop Filters panel is replaced by its slide-out trigger
- **THEN** Current filtered table remains visible above the Table or Map content
- **AND** its Filters trigger and permitted table actions remain keyboard-operable without duplicating the control group
