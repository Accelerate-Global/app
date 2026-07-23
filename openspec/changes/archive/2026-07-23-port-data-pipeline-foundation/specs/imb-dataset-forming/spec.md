## ADDED Requirements

### Requirement: IMB executes through the shared forming platform
The IMB forming workflow SHALL register as a source-specific engine on the generic forming platform while preserving the approved version-1 output contract and decision behavior.

#### Scenario: IMB fixture is formed through the adapter
- **WHEN** the approved IMB golden source fixture is built through the registered IMB engine
- **THEN** its columns, rows, findings, validation totals, lineage fields, and output checksum equal the pre-generalization expectation
- **AND** the candidate records the IMB engine metadata plus exact Country/ROG and ROP bindings

#### Scenario: Existing IMB route starts a build
- **WHEN** an administrator uses an existing IMB forming API or run-detail action
- **THEN** the request delegates to the shared lifecycle
- **AND** returns a backward-compatible response with the generic engine metadata available to the UI
