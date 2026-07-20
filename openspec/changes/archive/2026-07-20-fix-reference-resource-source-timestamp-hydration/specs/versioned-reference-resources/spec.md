## MODIFIED Requirements

### Requirement: Reference-resource lifecycle timestamps hydrate deterministically
The system SHALL render every server-rendered reference-resource metadata
timestamp with an explicit timezone and stable locale format so server-rendered
and browser-hydrated text are identical.

#### Scenario: Browser hydrates a reference-resource page in another timezone
- **WHEN** Vercel renders a Country/ROG or ROP lifecycle or source-retrieval
  timestamp in UTC and a signed-in user's browser hydrates the page in a
  different local timezone
- **THEN** every visible reference-resource metadata timestamp remains unchanged
- **AND** the page does not produce a React text-mismatch hydration error for
  those timestamps

#### Scenario: User views version history
- **WHEN** a dataset admin opens reference-resource version history
- **THEN** every version timestamp uses the same explicit timezone and stable
  locale format as the active-version timestamp
