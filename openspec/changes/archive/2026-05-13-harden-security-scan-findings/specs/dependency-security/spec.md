## ADDED Requirements

### Requirement: Runtime framework dependencies avoid known high-severity advisories
The repository SHALL keep production framework dependencies outside known
high-severity advisory ranges before release.

#### Scenario: Dependency audit checks framework advisories
- **WHEN** dependency versions or lockfile entries are changed
- **THEN** the repository dependency audit reports no high-severity advisory for
  the installed Next.js framework version

### Requirement: Toolchain transitive dependencies resolve to patched versions
The repository SHALL resolve installed toolchain transitive dependencies to
patched versions when the dependency audit reports high-severity vulnerable
paths through build or developer tooling.

#### Scenario: Dependency audit checks toolchain transitive paths
- **WHEN** the dependency audit inspects the installed dependency tree
- **THEN** vulnerable transitive packages in the `shadcn` toolchain path resolve
  to patched versions or are otherwise absent from the audited tree
