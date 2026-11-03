# dependency-security Specification

## Purpose
Define the dependency audit posture for production framework packages and
installed build/developer toolchain dependencies so known high-severity
advisory paths are patched before release.
## Requirements
### Requirement: Runtime framework dependencies avoid known high-severity advisories
The repository SHALL keep production framework dependencies outside known
high-severity advisory ranges before release.

#### Scenario: Dependency audit checks framework advisories
- **WHEN** dependency versions or lockfile entries are changed
- **THEN** the repository dependency audit reports no high-severity advisory for
  the installed Next.js framework version

#### Scenario: November 2026 critical Next.js advisories are resolved
- **WHEN** the repository audits the installed Next.js framework
- **THEN** the resolved Next.js version is outside the ranges affected by
  GHSA-673q-mjm6-r5xr, GHSA-2464-fhr4-w9xw, and GHSA-p3m5-59mp-jv5r
- **AND** the frozen lockfile install resolves `next` and the matching
  `eslint-config-next` release to the same patched version

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

### Requirement: Compatible lower-severity dependency advisories are remediated
The repository SHALL update or override moderate and low advisory paths when the patched versions remain compatible with application and verification workflows.

#### Scenario: Dependency updates are selected
- **WHEN** a moderate or low advisory has a compatible patched dependency release
- **THEN** the lockfile resolves the affected path to the patched release
- **AND** package-dependent tests and the full application verification lane pass

#### Scenario: Patch requires a breaking workflow change
- **WHEN** clearing a lower-severity advisory would require an unverified major framework or workflow replacement
- **THEN** the system retains the compatible version and records the advisory rather than silently breaking the application

### Requirement: Protected dependency audit clears the release threshold

The repository SHALL resolve the complete installed production and developer dependency graph without critical or high-severity advisories before a release can merge.

#### Scenario: Release candidate is audited
- **WHEN** the protected dependency audit evaluates the lockfile used by the release candidate
- **THEN** the audit exits successfully at the high-severity threshold
- **AND** the repository does not suppress or waive a critical or high-severity finding

#### Scenario: Patched transitive dependency crosses a compatibility boundary
- **WHEN** clearing an advisory requires a transitive override outside the parent package declared range
- **THEN** the package-dependent workflow and full application verification MUST pass with the exact resolved lockfile
- **AND** the protected dependency audit MUST pass before merge

#### Scenario: September 2026 high-severity advisories are resolved
- **WHEN** the repository audits the resolved Next.js, workflow, undici, and brace-expansion dependency paths
- **THEN** no critical or high-severity advisory remains in the installed tree
