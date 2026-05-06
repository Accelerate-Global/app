## MODIFIED Requirements

### Requirement: Manual appearance choices
The account menu SHALL expose explicit `System`, `Light`, and `Dark` appearance
choices as one compact segmented control.

#### Scenario: User views appearance choices
- **WHEN** a signed-in user opens the account menu
- **THEN** the menu shows one Appearance row with System, Light, and Dark
  options
- **AND** the menu does not show three separate System, Light, and Dark rows

#### Scenario: User selects an explicit dark override
- **WHEN** a user selects `Dark` from the Appearance segmented control
- **THEN** the page uses dark appearance regardless of the current operating
  system color scheme

#### Scenario: User returns to system preference
- **WHEN** a user selects `System` from the Appearance segmented control
- **THEN** the page resolves appearance from the operating system color scheme
  again
