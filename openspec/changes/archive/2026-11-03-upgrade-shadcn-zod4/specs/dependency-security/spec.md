## MODIFIED Requirements

### Requirement: Toolchain transitive dependencies resolve to patched versions
The repository SHALL resolve installed toolchain transitive dependencies to
patched versions when the dependency audit reports high-severity vulnerable
paths through build or developer tooling.

#### Scenario: Dependency audit checks toolchain transitive paths
- **WHEN** the dependency audit inspects the installed dependency tree
- **THEN** vulnerable transitive packages in the `shadcn` toolchain path resolve
  to patched versions or are otherwise absent from the audited tree

#### Scenario: Same-major security pins are applied
- **WHEN** an audited transitive package has a patched release in its current major version
- **THEN** the lockfile resolves it to the lowest patched release in that major
  through a `package.json` `pnpm.overrides` security pin
- **AND** `pnpm install --frozen-lockfile` passes with the resulting lockfile

#### Scenario: Toolchain upgrade replaces an unpatchable transitive major
- **WHEN** an advisory has no patched release in the major version a toolchain
  package requires
- **THEN** the toolchain package is upgraded to a release that accepts the
  patched major, rather than forcing the newer major onto the older release
- **AND** the build output is compared before and after to confirm the upgrade
  causes no visual change
