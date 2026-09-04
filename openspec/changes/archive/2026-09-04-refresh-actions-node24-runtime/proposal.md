## Why

GitHub now forces several repository-owned workflow actions from their declared
Node.js 20 runtime onto Node.js 24 and emits deprecation warnings on every run.
Pinned official Node.js 24 releases are available, so leaving the warnings would
turn a known compatibility deadline into hidden CI debt.

## What Changes

- Refresh every repository-owned GitHub Action that declares Node.js 20 to its
  current official Node.js 24 release, pinned to an immutable full commit SHA.
- Keep existing workflow inputs, permissions, cache paths, security controls,
  and job behavior unchanged.
- Update workflow-policy fixtures so examples no longer normalize obsolete
  action revisions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-automation`: Require repository-owned remote action pins to use a
  supported GitHub Actions runtime and remain immutable full-SHA references.

## Impact

- Repository automation only: `.github/actions/setup-pnpm-node/action.yml`, the
  six pull-request/release workflows, and their same-stem policy test fixtures.
- GitHub-hosted Actions runners will execute the official checkout, cache,
  Node/pnpm setup, Supabase CLI setup, and artifact upload releases on Node 24.
- Auth, admin permissions, application APIs, data integrity, Supabase schema and
  data, Vercel deployment behavior, and UI smoke coverage are unchanged.
- Non-goals: changing Node.js 22 for application builds, pnpm 10, Supabase CLI
  2.75.0, workflow triggers, required checks, or published artifact contents.
