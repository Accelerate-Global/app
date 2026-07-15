## Why

Dataset administrators can already import a private Google Sheet by sharing it
with the app service account, but the imported dataset remains a raw snapshot.
Preparing that data for Joshua Project or another partner still requires a
manual spreadsheet workflow, which is difficult to reproduce, validate, and
audit. The existing aggregate field-mapping CSV is reference metadata only; it
does not transform an imported dataset into a partner contract.

Joshua Project has supplied a concrete header-level exchange contract. We need
a safe, reusable way to turn a selected imported dataset into that contract
without changing the source dataset or sending data outside the application.
At the same time, the Google Sheets connection lifecycle needs to preserve run
history and archived artifacts when a connection is disconnected, and remain
resilient when a selected Sheet tab is renamed.

## What Changes

- Add admin-only, reusable partner export profiles that are attached to one
  existing source dataset. A profile selects source columns, assigns ordered
  output headers, applies a small allow-listed set of deterministic
  transformations, and defines required-field and value validation rules.
- Provide a Joshua Project starter profile whose output contract uses the
  requested identifiers, geography, names, organization, engagement, and
  approximate-believer/church headers. The profile remains reviewable and
  editable by an administrator rather than treating a field-mapping CSV as an
  executable transformation.
- Let an administrator preview the resulting rows, inspect a header crosswalk
  and validation results, and explicitly generate a private CSV artifact for
  local download. Generated exports retain source-dataset and profile
  provenance for auditability; they never mutate source rows or automatically
  deliver data to a partner.
- Add private persistence and access controls for profiles and generated export
  runs, including immutable output and validation artifacts. Keep all routes
  admin-authorized and subject to the existing same-origin protections.
- Harden service-account Google Sheets connections: prevent duplicate active
  connections to the same Sheet tab, resolve a selected tab by its stable Google
  sheet ID so a rename does not break refreshes, and archive/deactivate rather
  than delete a disconnected connection so its runs and artifacts remain
  inspectable.
- Add focused unit, integration, migration, and UI smoke coverage plus
  operator documentation for the mapping and local-download workflow.

## Capabilities

### New Capabilities

- `partner-export-profiles`: Dataset administrators can configure, validate,
  preview, generate, audit, and locally download reusable partner-specific CSV
  exports from a single imported dataset.

### Modified Capabilities

- `api-connection-runs`: Google Sheets connection management retains audit
  history on disconnect and consistently identifies a selected Sheet tab across
  renames while avoiding duplicate active tab connections.

## Impact

- Affected application areas: dataset administration, API connection lifecycle,
  source-data download/export UI, private artifact storage, and field-source
  reference mapping.
- Affected data: new private profile/export-run records and storage artifacts;
  a migration for connection archival/active-source uniqueness; existing raw
  datasets, dataset versions, API connection runs, and artifacts are preserved.
- Affected security: no OAuth, Google Drive browsing, public Sheets, or
  per-user provider credentials are introduced. Service-account credentials stay
  server-side, exports stay private, and only dataset administrators can manage
  or download them.
- Affected verification: direct transformation and route tests, migration/RLS
  coverage, `smoke:check` and targeted UI smoke fixtures for new interactive
  surfaces, OpenSpec validation, and the repository change-verification gate.

## Non-Goals

- Google Drive folder discovery, an OAuth consent flow, or user-supplied Google
  credentials.
- Combining or joining multiple Sheets/datasets in one export.
- Scheduled refreshes, scheduled export generation, or email/Drive/API delivery
  to a partner.
- Editing source Sheet data, changing imported dataset rows, or offering an
  arbitrary user-authored expression language for transformations.
