## ADDED Requirements

### Requirement: Map styling follows the AX design system appearance

The system MUST derive the map canvas, empty-country fill, ordered matching-record intensity ramp, boundary, selected-country outline, focus treatment, legend, and map-related selection feedback from semantic AX design-system colors. Those colors MUST respond to the application's effective light or dark appearance while preserving the semantic separation between record intensity and country selection.

#### Scenario: User views the map in light appearance

- **WHEN** the effective application appearance is light and Map mode is rendered
- **THEN** the map and legend use the light AX semantic palette
- **AND** matching-record intensity, empty geography, boundaries, focus, and selection remain distinguishable

#### Scenario: User views the map in dark appearance

- **WHEN** the effective application appearance is dark and Map mode is rendered
- **THEN** the map and legend use the dark AX semantic palette rather than fixed light-theme colors
- **AND** matching-record intensity, empty geography, boundaries, focus, and selection remain distinguishable

#### Scenario: Effective appearance changes while the map is open

- **WHEN** the user or system changes the effective appearance while Map mode remains mounted
- **THEN** the map canvas, rendered features, legend, and map-related selection feedback update to the new semantic palette
- **AND** filtered rows, counts, selected country, and map position remain unchanged

#### Scenario: Maintainer reviews the map color implementation

- **WHEN** map presentation code is inspected or tested
- **THEN** one ordered semantic count ramp drives both country fills and the matching-record legend
- **AND** feature styling does not depend on hard-coded teal or slate hexadecimal colors
