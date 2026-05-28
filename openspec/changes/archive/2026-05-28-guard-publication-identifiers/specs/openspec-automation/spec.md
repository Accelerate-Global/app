## ADDED Requirements

### Requirement: Current tracked files avoid real personal admin identifiers

The repository SHALL prevent known real personal/admin identifiers from being
reintroduced into tracked text files before release checks pass.

#### Scenario: Tracked text file contains a disallowed personal/admin identifier

- **WHEN** app verification tests inspect tracked text files
- **AND** a file contains a known disallowed personal/admin identifier pattern
- **THEN** the verification fails and reports the file path and pattern class

#### Scenario: Tracked files use neutral examples

- **WHEN** tracked tests, docs, specs, or migration fixtures need email-shaped
  values
- **THEN** neutral example identities such as `example.com` values pass the
  publication-safety verification
