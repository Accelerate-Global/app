## ADDED Requirements

### Requirement: Engines declare all forming dependencies
Each forming engine SHALL declare every catalog resource and code-defined contract required to reproduce its output, including stable key, expected kind or contract type, schema/version compatibility, and requiredness.

#### Scenario: All declared dependencies resolve
- **WHEN** a candidate build starts and the current immutable resource set contains valid checksummed versions for every required catalog dependency while every code contract has a version and checksum
- **THEN** the lifecycle persists the ordered resolved bindings and permits engine execution

#### Scenario: Required dependency is missing or unhealthy
- **WHEN** a declared resource is absent, invalid, incompatible, unchecksummed, or not a member of the selected set
- **THEN** the system rejects the build before transformation
- **AND** reports the affected engine and dependency without substituting a mutable latest value

### Requirement: Resource changes expose pipeline impact
The system SHALL identify pipeline definitions and recent candidates or publications that bind a superseded resource or contract version without automatically rebuilding or republishing them.

#### Scenario: New resource version activates
- **WHEN** an administrator activates a valid resource version
- **THEN** the resource detail can report registered engines that require that resource and recent outputs built with older bindings
- **AND** existing candidates and publications remain unchanged until an administrator starts and approves a new build
