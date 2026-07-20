## REMOVED Requirements

### Requirement: Admins can triage grouped analytics failures
**Reason**: The standalone internal Analytics dashboard is retired in favor of
authentication recency in User Management, leaving no supported product surface
for grouped failure triage.

**Migration**: Preserve internal analytics events and historical triage records;
remove only the page-specific mutation API and UI.

### Requirement: Analytics page distinguishes raw failures from open known failures
**Reason**: The retired Analytics page no longer presents event or failure counts.

**Migration**: Operational analytics persistence remains available to server-side
diagnostics; administrators use User Management for sign-in recency.

### Requirement: Expected and resolved failures explain count differences
**Reason**: Expected and resolved failure group presentation belonged exclusively
to the retired Analytics page.

**Migration**: Retain historical classifications without exposing the removed
group-count UI.

### Requirement: Resolved failures reopen after new occurrences
**Reason**: Automatic display-time reopening was part of the removed grouped
failure-triage workflow.

**Migration**: Retain stored event and triage data; a future diagnostic workflow
must define its own current reopening behavior before reusing it.
