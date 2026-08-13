## REMOVED Requirements

### Requirement: Legacy cutover is per-flow and non-dual-write
**Reason**: AX Online onboarding now uses only current source evidence and has no AX Data comparison, matching, or cutover workflow.
**Migration**: Replace legacy parity/cutover gates with one-source-at-a-time current-source canaries, review, live-target verification, and rollback rehearsal.
