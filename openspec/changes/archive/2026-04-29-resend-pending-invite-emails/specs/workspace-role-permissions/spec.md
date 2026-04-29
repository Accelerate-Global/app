## ADDED Requirements

### Requirement: Accepted invited accounts are not pending invites
The system SHALL treat invited accounts as pending only until the invite has
been accepted or the account is otherwise confirmed.

#### Scenario: Confirmed invited account is active
- **WHEN** an invited user has a confirmed timestamp or email confirmed timestamp
- **THEN** User Management reports the account as active rather than pending
  invite

#### Scenario: Unaccepted invited account is pending
- **WHEN** an invited user has no confirmed timestamp, no email confirmed
  timestamp, and no last login timestamp
- **THEN** User Management reports the account as pending invite
