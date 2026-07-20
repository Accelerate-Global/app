## ADDED Requirements

### Requirement: User Management reports successful sign-in recency
The system SHALL show dataset admins each workspace user's most recent successful
Supabase Auth sign-in without representing that timestamp as broader application
activity.

#### Scenario: User has signed in
- **WHEN** a dataset admin views User Management for a user whose
  `auth.users.last_sign_in_at` is present
- **THEN** the Users table shows the timestamp in a `Last sign-in` column
- **AND** the user detail surface labels the same value `Last sign-in`

#### Scenario: User has never signed in
- **WHEN** a dataset admin views User Management for a user without a successful
  sign-in timestamp
- **THEN** the `Last sign-in` column shows `Never`

#### Scenario: Sign-in recency is not generalized activity
- **WHEN** an administrator reviews the Last sign-in value
- **THEN** the application does not label it Last activity
- **AND** the application does not infer session frequency or post-authentication
  activity from the timestamp
