## MODIFIED Requirements

### Requirement: Partner export editing and download naming are traceable
The system SHALL render the partner export profile editor at full viewport width
on mobile and two-thirds of the viewport width on tablet and desktop screens.
The feature width SHALL override the shared Sheet maximum-width default. For
each authorized artifact download, the system SHALL return a filesystem-safe
filename containing the source dataset name, the profile filename stem, and the
UTC timestamp of that download request, followed by the artifact-specific suffix
and extension.

#### Scenario: Administrator opens the profile editor on mobile
- **WHEN** a dataset administrator opens a partner export profile editor on a mobile viewport
- **THEN** the editor uses the full viewport width
- **AND** its existing scrollable content and save controls remain usable

#### Scenario: Administrator opens the profile editor on a wider viewport
- **WHEN** a dataset administrator opens a partner export profile editor at the tablet breakpoint or wider
- **THEN** the editor uses two-thirds of the viewport width without a narrow shared maximum-width cap
- **AND** the source dataset page remains visible beside it

#### Scenario: Administrator downloads a completed artifact
- **WHEN** a dataset administrator downloads a completed CSV, crosswalk, or validation artifact
- **THEN** the response filename includes sanitized source dataset and profile filename fragments
- **AND** it includes the UTC timestamp of that download request
- **AND** it ends with `.csv`, `-crosswalk.json`, or `-validation.json` according to the requested artifact
- **AND** the immutable stored artifact, authorization, and file contents remain unchanged
