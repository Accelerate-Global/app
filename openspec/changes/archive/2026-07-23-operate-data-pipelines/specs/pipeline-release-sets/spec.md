## ADDED Requirements

### Requirement: Coordinated release selection remains explicit and exact
The coordinator SHALL validate code-defined release completeness from exact publications but SHALL require an authorized explicit finalization decision before the release becomes usable.

#### Scenario: Candidate release is complete
- **WHEN** every configured source publication is present
- **THEN** the coordinator reports it ready for review rather than silently finalizing or following future publications

#### Scenario: Release review is rejected
- **WHEN** an administrator rejects the proposed release with a reason
- **THEN** the release domain records the rejection before the coordinator closes the stage
- **AND** no merge, aggregate, or publication stage becomes runnable
