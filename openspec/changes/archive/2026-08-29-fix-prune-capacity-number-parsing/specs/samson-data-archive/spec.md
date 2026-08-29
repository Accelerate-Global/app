## MODIFIED Requirements

### Requirement: Free-tier headroom is measured and protected
Every successful or failed backup cycle SHALL measure live Supabase database and Storage usage and SHALL report warning status at 350 MiB database or 750 MiB Storage and critical status at 425 MiB database or 900 MiB Storage. Every protected prune plan SHALL report current Storage bytes, planned removal bytes, projected Storage bytes, and the selected retention profile. Database numeric representations used for Storage totals or object sizes MUST be accepted only when they represent an exact nonnegative safe integer and MUST be normalized before capacity calculation, canonical plan validation, and checksum creation.

#### Scenario: Usage enters warning range
- **WHEN** either live usage measure meets its warning threshold
- **THEN** the system emits a deduplicated sanitized capacity alert
- **AND** produces or refreshes an archive eligibility report using the explicitly configured retention profile

#### Scenario: Reviewed plan reaches the warning target
- **WHEN** a protected plan's exact eligible objects would bring current Storage below the configured warning threshold
- **THEN** the plan reports that projection and retains it in the canonical checksum
- **AND** deletion still requires all restore and operator approval gates

#### Scenario: Database returns a whole-number byte value as text
- **WHEN** PostgreSQL returns a current Storage total or eligible object size as a decimal digit string within the safe-integer range
- **THEN** the planner normalizes it to the exact integer before calculating and checksumming the protected plan
- **AND** the resulting projection matches the same aggregate returned as a number

#### Scenario: Database returns an invalid capacity aggregate
- **WHEN** a capacity aggregate is missing, negative, fractional, malformed, or greater than the safe-integer range
- **THEN** plan generation fails without writing an approvable plan
- **AND** no Storage deletion occurs

#### Scenario: Active working set remains critical after verified pruning
- **WHEN** no eligible historical payload under the bounded capacity profile can bring a critical usage measure below its warning threshold
- **THEN** the system reports that the active working set no longer fits the free-first design
- **AND** requires a separate paid-Supabase versus Samson self-hosting decision
