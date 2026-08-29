# Samson data archive guest

The production worker runs in unprivileged Proxmox LXC guest `104` (`ax-data-archive`). Backup dependencies are not installed on the Samson hypervisor.

The host mounts `samson-backup/ax-online-archive` at `/srv/ax-data-archive` and passes only that dataset into the guest. The dataset uses Zstandard compression, `atime=off`, a 50 GiB quota, and never changes `samson-backup/vzdump`.

The guest has outbound access for Supabase, Vercel, Resend, PostgreSQL package provenance, and operating-system updates. Its firewall drops unsolicited inbound traffic. Administration uses `pct enter 104` from Samson; the guest does not run SSH or expose a public listener.

Provisioning sequence:

1. Run `provision-host.sh` on Samson.
2. Stage the allowlisted worker files under `/opt/ax-data-archive-source` in guest 104.
3. Run `provision-guest.sh` in the guest.
4. Place service-only credential files in `/etc/ax-data-archive/secrets` and the root-readable environment file at `/etc/ax-data-archive/worker.env`.
5. Initialize Restic once with `restic init` under the service account.
6. Run one manual backup, full restore drill, and exact API-package restore
   verification before enabling any production pruning.

The timer is intentionally disabled by provisioning. Enable it only after the production database migration, read-only database login, RLS-scoped Storage identity, receipt route, and direct alert credentials are verified.

PostgreSQL uses `verify-full` with the pinned Supabase Root 2021 CA in
`/etc/ax-data-archive/supabase-root-2021.crt`; do not replace it with
`sslmode=require` or disable certificate verification.

This is single-site recovery. The mirror tolerates one disk failure; it does not protect against loss of Samson or the Bethany site.

API artifact hot retention defaults to 30 days and the latest three successful
runs per connection. During a reviewed free-tier capacity incident, the bounded
profile may be set to 7 days and the latest one. The selected profile controls
both package creation and the protected prune plan; it never triggers deletion
automatically.

`scripts/data-archive-verify-package.ts` is the Samson-only restore-proof entry
point. It requires an exact package key, stable request key, owner, `--approve`,
and a one-invocation `DATA_ARCHIVE_PACKAGE_VERIFICATION_ENABLED=true` gate. It
restores into private staging, verifies the canonical manifest and every member,
deletes staging content, and sends signed evidence through the existing receipt
boundary. It never needs a write-capable database credential on Samson.
