## ADDED Requirements

### Requirement: Successful background imports refresh connection dataset navigation
The system SHALL update the connection detail experience when a queued or running import reaches a terminal state without requiring a full browser reload.

#### Scenario: First import succeeds
- **WHEN** polling observes that a first import changed from queued or running to success and created a target dataset
- **THEN** the UI replaces the queued message with the final success result, refreshes connection state exactly once, and shows an **Open dataset** action for the created dataset

#### Scenario: Dataset refresh succeeds
- **WHEN** polling observes that a refresh import changed from queued or running to success for an existing target dataset
- **THEN** the UI shows the final success result and preserves navigation to the refreshed dataset without repeatedly refreshing the page

#### Scenario: Import fails
- **WHEN** polling observes that an import changed from queued or running to failed
- **THEN** the UI replaces the queued message with the redacted failure result and does not expose navigation to a dataset that was not created
