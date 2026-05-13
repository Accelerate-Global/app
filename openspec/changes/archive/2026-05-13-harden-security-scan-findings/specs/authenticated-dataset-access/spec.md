## ADDED Requirements

### Requirement: Dataset CSV downloads neutralize spreadsheet formulas
Dataset and saved-table CSV downloads SHALL serialize accessible row data in a
way that prevents spreadsheet software from interpreting formula-leading cell
values as executable formulas.

#### Scenario: User downloads dataset rows with formula-leading values
- **WHEN** an authenticated user downloads a dataset containing a cell whose
  first non-space character is `=`, `+`, `-`, `@`, tab, carriage return, or
  newline
- **THEN** the CSV cell is emitted as text by prefixing an apostrophe before
  the dangerous value
- **AND** the download still follows the existing dataset access rules

#### Scenario: User downloads normal dataset rows
- **WHEN** an authenticated user downloads dataset or saved-table rows without
  formula-leading values
- **THEN** the CSV preserves existing delimiter, quote, and line-ending behavior
