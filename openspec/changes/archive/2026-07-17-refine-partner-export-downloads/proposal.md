## Why

Administrator navigation and partner-export tooling use labels and layouts that
obscure their purpose, while generated artifact names omit the source dataset
and the moment the administrator downloaded them. Clearer wording, a usable
half-width editor, and traceable download names make the workflow easier to use
and safer to audit.

## What Changes

- Rename the administrator account-menu item from `Manage Field Sources` to
  `Field Sources` without changing its route, icon, or permissions.
- Render the partner export profile sheet at full width on mobile and one-half
  of the viewport on tablet and desktop screens.
- Name every downloaded partner-export artifact with the sanitized source
  dataset name, configured profile filename stem, and UTC download timestamp,
  while preserving the artifact-specific extension/suffix.
- Clarify in the profile editor that the dataset name and timestamp are added
  automatically at download time.
- Preserve the existing Joshua Project 13-header starter contract, profile
  management, authorization, private Storage, and generated artifact contents.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-layout`: Rename the administrator field-source navigation label.
- `partner-export-profiles`: Define the responsive editor width and traceable
  download filename contract.

## Impact

- UI: `src/components/auth/account-control.tsx` and
  `src/components/dashboard/dataset-partner-exports.tsx` plus their direct
  tests.
- Server/export naming: `src/lib/partner-exports/` and the existing authorized
  artifact download route.
- Specifications: `openspec/specs/dashboard-layout/spec.md` and
  `openspec/specs/partner-export-profiles/spec.md` through delta specs.
- Auth/admin permissions, source and artifact data integrity, Supabase schema,
  Vercel deployment behavior, and API authorization do not change.
- The existing partner-export sheet smoke surface remains in place; no new
  route or shared UI primitive is introduced.
