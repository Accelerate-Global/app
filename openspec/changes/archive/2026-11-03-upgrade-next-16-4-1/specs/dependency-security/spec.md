## MODIFIED Requirements

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
