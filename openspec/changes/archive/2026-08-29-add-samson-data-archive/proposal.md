## Why

AX Online needs durable, long-lived dataset recovery without depending on paid Supabase or Vercel storage. Production currently uses about 272 MB of Supabase database space and 1.15 GB of Supabase Storage, while the intended free tier allows 500 MB of database data and 1 GB of Storage, so immutable history must be verified outside Supabase before eligible hot copies can be removed.

## What Changes

- Keep Vercel as the live application host and Supabase as the live Auth, Postgres, and short-retention Storage provider.
- Add an outbound-only backup and archive service on the Samson Proxmox server, isolated from the hypervisor in a dedicated guest and backed by an encrypted, compressed, deduplicated Restic repository on mirrored ZFS.
- Run a complete backup at 2:00 AM America/Los_Angeles, covering roles, schema, data, Auth/account records, migration history, every Storage bucket, and a checksummed manifest.
- Add a small Supabase archive catalog that records verified Samson packages without storing archived payloads in Supabase.
- Add archive eligibility and rehydration workflows so inactive historical records and objects can leave Supabase only after backup, integrity verification, and a successful restore check; active or referenced evidence remains hot.
- Retain at least 30 days and the three latest valid versions in Supabase, subject to stronger dependency pins for active targets, open runs, candidates, publications, and rollback evidence.
- Route sanitized backup, archive, quota, and restore failures to the existing operational email destination without including data, credentials, or recovery keys.
- Monitor free-tier headroom and stop pruning on any catalog, checksum, repository, or restore-verification failure.
- Record the current single-site limitation explicitly: no off-site backup destination exists. The design must allow a future encrypted second repository without claiming off-site disaster protection today.
- Keep the application, public database, and Auth service off Samson for now. Full self-hosting is deferred until the active working set alone can no longer remain safely below Supabase Free limits.

### Non-goals

- Exposing Samson or its backup guest to inbound public internet traffic.
- Using Vercel Blob or another metered cloud store as the long-term archive.
- Enabling paid Supabase automatic backups or point-in-time recovery.
- Automatically deleting active datasets, current reference projections, unfinished pipeline inputs, or the last three valid recovery versions.
- Promising site-loss recovery before a physically separate destination is available.

## Capabilities

### New Capabilities

- `samson-data-archive`: Nightly complete backup, content-addressed long-term archive, safe hot-data pruning, quota monitoring, integrity verification, operator rehydration, recovery drills, and explicit single-site recovery status.

### Modified Capabilities

- `api-connection-runs`: Permit eligible historical run artifacts to transition from Supabase Storage to the Samson archive while remaining cataloged and operator-rehydratable.
- `authenticated-dataset-access`: Fail closed if dataset-version evidence is marked cold and prepare verified-rehydration checks for a separately released expansion; dataset versions remain hot in the initial rollout.
- `tier1-merge-products`: Fail closed if publication evidence is marked cold and accept only verified rehydrated evidence, while keeping Tier 1 payloads hot in the initial rollout.
- `tier2-release-products`: Apply the same cold/verified-rehydrated rollback guard to Tier 2 and Aggregate 2 while keeping their payloads hot in the initial rollout.
- `deployment-secret-security`: Extend server-only secret requirements to the isolated Samson backup service and its database, Storage, Restic, and email credentials.
- `operational-alert-email-delivery`: Deliver sanitized backup/archive/recovery alerts through the existing operational email destination without making Supabase availability a prerequisite for emitting a failure alert.

## Impact

- **Supabase:** Adds compact archive/backup metadata, archive eligibility checks, rehydration bookkeeping, and controlled pruning. Auth users remain live and are included in full database exports. Existing RLS and immutable-history protections remain authoritative.
- **Samson:** Adds a dedicated backup guest and ZFS dataset. The verified `samson-backup` mirrored pool has approximately 5.29 TiB available; the initial archive budget is 50 GB with growth alerts.
- **Vercel:** Remains the live Next.js host. No long-term payload is added to Vercel Blob, and no public route exposes Samson.
- **Application and APIs:** Admin history/download/rollback paths must distinguish hot versus cold evidence and require operator rehydration before cold payloads are used.
- **Security:** Backup credentials and Restic recovery material remain server-only, out of Git, and unavailable to browser roles. No raw data appears in operational alerts.
- **Data integrity:** Pruning is fail-closed and can occur only after verified local archive creation and restore evidence. Existing current-state recovery guidance in `docs/operations/reference-resources.md`, version behavior in `docs/data-pipeline/tier1-products.md` and `docs/data-pipeline/tier2-products.md`, and the unresolved provider policy in `docs/open-questions.md` are replaced or extended by an explicit operator runbook.
- **UI smoke:** No new route is required by default. Any new admin archive surface or modal must follow the repository smoke-marker and route-registry contracts.
