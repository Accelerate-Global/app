## Why

Accelerate Global source, supporting files, local configuration and useful development state currently depend on Blake's Mac. A dedicated Samson workspace and scoped Codex Cloud connection should let project work continue when that Mac is unavailable.

## What Changes

- Establish a dedicated Linux development VM and preserve both repositories, all local refs, supporting documents and useful ignored material with checksum verification and rollback copies.
- Add portable migration, Cloud SSH and task-worktree helpers with fail-closed destination, path and identity checks.
- Rebuild Linux tools and development configuration; move protected legacy credentials and local database archives into operator-only recovery storage rather than an agent-accessible environment.
- Document Cloud Tailscale enrollment, destination grants, pinned OpenSSH authentication, backup/restore and an explicit Mac-independent cutover test.
- Report partial readiness accurately when account-owned VPN configuration or Cloud transport cannot yet be qualified.
- Implement the private HTTPS job-interface fallback when the account cannot supply raw TCP: capability-authenticated, task-scoped file operations and fixed verification jobs through the managed HTTP proxy.

## Capabilities

### New Capabilities

- `samson-development-workspace`: Verified durable project migration, isolated development execution, scoped Cloud connectivity and recoverable cutover.

### Modified Capabilities

None.

## Impact

Repository-owned additions are under `infra/samson-development/`, `docs/operations/samson-development.md` and the associated OpenSpec capability. Existing `docs/developer/getting-started.md`, `.github/actions/setup-pnpm-node/action.yml`, `docs/operations/samson-data-archive.md` and the parent migration assessment establish the current boundaries and toolchain.

Linux qualification also updates the private data repository's stale Tier 2 runner test to validate its existing explicit dataset CLI contract. Pipeline implementation and publication behavior are unchanged.

The change affects development workflow and private infrastructure access. It does not change application authentication, admin permissions, public APIs, UI smoke coverage, hosted Supabase data/RLS or Vercel deployment behavior. Temporary local Supabase services are used only for verification. Production publishing, release, historical deletion, other guests and off-site provider acquisition are non-goals.
