## ADDED Requirements

### Requirement: Samson Node workers remain compatible with service memory hardening
The scheduled backup and missed-run workers MUST start under the configured prohibition on writable-executable memory and SHALL retain that protection in production.

#### Scenario: Hardened backup worker starts
- **WHEN** systemd starts the Node-based backup worker with writable-executable memory prohibited
- **THEN** the worker runtime starts without a V8 executable-memory failure
- **AND** the memory protection remains enabled

#### Scenario: Hardened missed-run worker starts
- **WHEN** systemd starts the Node-based missed-run checker with writable-executable memory prohibited
- **THEN** the checker completes its configured evaluation without a runtime executable-memory failure
- **AND** it preserves the same sanitized alert behavior
