# system-appearance Specification

## Purpose
Define how the app resolves light and dark appearance from the user's operating system preference, while preserving explicit manual overrides from the account menu.

## Requirements
### Requirement: System appearance default
The system SHALL default to a `system` appearance preference and resolve the rendered theme from the user's operating system color scheme.

#### Scenario: First visit follows dark system
- **WHEN** a browser has no new explicit appearance preference and reports `prefers-color-scheme: dark`
- **THEN** the page renders with dark appearance before React hydration completes

#### Scenario: Legacy stored toggle does not override system
- **WHEN** a browser only has the legacy two-state theme storage value from the old menu toggle
- **THEN** the page ignores or clears that legacy value and uses the `system` appearance preference

### Requirement: System changes update rendered appearance
The system SHALL update rendered light/dark appearance when the operating system color scheme changes while the active preference is `system`.

#### Scenario: System switches after load
- **WHEN** the active preference is `system` and the operating system color scheme changes
- **THEN** the page updates the `.dark` document class and CSS `color-scheme` to match the new system value

### Requirement: Manual appearance choices
The account menu SHALL expose explicit `System`, `Light`, and `Dark` appearance choices.

#### Scenario: User selects an explicit dark override
- **WHEN** a user selects `Dark` in the account menu
- **THEN** the page uses dark appearance regardless of the current operating system color scheme

#### Scenario: User returns to system preference
- **WHEN** a user selects `System` in the account menu
- **THEN** the page resolves appearance from the operating system color scheme again
