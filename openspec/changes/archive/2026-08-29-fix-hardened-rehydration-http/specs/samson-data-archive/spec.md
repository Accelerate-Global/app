## MODIFIED Requirements

### Requirement: Samson Node workers remain compatible with service memory hardening
The scheduled backup, missed-run, package-verification, and rehydration workers MUST start under the configured prohibition on writable-executable memory and SHALL retain that protection in production. Provider-facing HTTPS used by those workers MUST avoid a runtime dependency on WebAssembly.

#### Scenario: Hardened backup worker starts
- **WHEN** systemd starts the Node-based backup worker with writable-executable memory prohibited
- **THEN** the worker runtime starts without a V8 executable-memory failure
- **AND** the memory protection remains enabled

#### Scenario: Hardened missed-run worker starts
- **WHEN** systemd starts the Node-based missed-run checker with writable-executable memory prohibited
- **THEN** the checker completes its configured evaluation without a runtime executable-memory failure
- **AND** it preserves the same sanitized alert behavior

#### Scenario: Hardened package verification starts
- **WHEN** systemd starts an exact package restore-verification under the same memory protection
- **THEN** catalog lookup, Restic restore, checksum verification, and signed receipt submission complete without WebAssembly initialization
- **AND** temporary staging is removed

#### Scenario: Hardened rehydration starts
- **WHEN** systemd starts an approved exact API-package rehydration under the same memory protection
- **THEN** Restic verification plus exact Storage upload, conflict verification, and cleanup use a WebAssembly-free HTTPS path
- **AND** the memory protection remains enabled without exposing credentials or broadening the Storage target
