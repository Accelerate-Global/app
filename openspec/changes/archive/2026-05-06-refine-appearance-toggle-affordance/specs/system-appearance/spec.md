## MODIFIED Requirements

### Requirement: Manual appearance choices
The account menu SHALL expose explicit `System`, `Light`, and `Dark` appearance
choices as one compact segmented control without a dynamic selected-theme
description.

#### Scenario: User views appearance choices
- **WHEN** a signed-in user opens the account menu
- **THEN** the menu shows one static Appearance row with System, Light, and Dark
  options
- **AND** the menu does not show a dynamic selected-theme description such as
  `System (Light)`, `Light`, or `Dark`
- **AND** the menu does not show three separate System, Light, and Dark rows

#### Scenario: User hovers an unselected appearance option
- **WHEN** a signed-in user hovers an unselected option in the Appearance
  segmented control
- **THEN** only that option receives hover background feedback
- **AND** other unselected options remain background-free

#### Scenario: User selects an appearance option
- **WHEN** a signed-in user selects one option in the Appearance segmented
  control
- **THEN** the selected option keeps the selected background
- **AND** unselected options do not keep a background

#### Scenario: User selects an explicit dark override
- **WHEN** a user selects `Dark` from the Appearance segmented control
- **THEN** the page uses dark appearance regardless of the current operating
  system color scheme

#### Scenario: User returns to system preference
- **WHEN** a user selects `System` from the Appearance segmented control
- **THEN** the page resolves appearance from the operating system color scheme
  again
