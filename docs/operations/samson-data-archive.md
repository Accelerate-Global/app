# Samson Data Archive Operations

## Status

The archive worker and guest are provisioned under OpenSpec change
`add-samson-data-archive`. Production scheduling remains disabled until the
tracked migration and receipt route are released, the remaining service-only
credentials are installed, and the first isolated restore drill passes. No
production pruning is enabled. Samson is a single-site recovery location;
its mirrored disks do not provide protection from loss of the server or site.

## Approved architecture

- Vercel remains the live application host.
- Supabase remains the live Auth, Postgres, and short-retention Storage service.
- An isolated Samson guest pulls backups over outbound TLS at 2:00 AM
  `America/Los_Angeles`.
- Restic owns encrypted, compressed, deduplicated snapshots on a dedicated ZFS
  dataset.
- Vercel never connects to Samson during an application request, and Samson has
  no public listener or router port forward.

## Verified least-privilege export boundary

The local Supabase spike on 2026-08-26 proved the following design without a
production credential or full-access S3 key:

1. Create a dedicated Postgres login with `NOSUPERUSER`, `NOCREATEDB`,
   `NOCREATEROLE`, `NOINHERIT`, and `BYPASSRLS`.
2. Grant only database `CONNECT`, schema `USAGE`, table `SELECT`, and sequence
   `USAGE, SELECT` on the application-owned `public`, `private`, and
   `supabase_migrations` schemas. `BYPASSRLS` is required so an otherwise
   granted private table remains readable during `pg_dump`; it does not grant
   insert, update, delete, DDL, or role-management privileges.
3. Supabase's managed `auth` and `storage` schemas cannot delegate their table
   privileges from the ordinary `postgres` login. Export those rows through a
   `SECURITY DEFINER` function in the unexposed `private` schema that:
   - has an empty `search_path`;
   - accepts only `auth` or `storage` as a fixed allowlist;
   - requires the exact backup `session_user`;
   - rejects any JWT-backed call where `auth.uid()` is non-null;
   - returns row JSON with table identity and deterministic ordinals;
   - is revoked from `PUBLIC` and executable only by the backup login.
4. Create a dedicated Supabase Auth service identity whose server-controlled
   `raw_app_meta_data` contains `data_archive_role = reader`.
5. Grant that identity only a `SELECT` RLS policy on `storage.objects`, and use
   its JWT as an S3 session token. The spike verified S3 list and download and
   verified that upload, copy, and delete were denied.

Negative tests also proved the Postgres backup login could not create an
application table, delete Storage metadata, or insert into an RLS-protected
private audit table. The private export function rejected the ordinary
`postgres` session because it was not the dedicated backup `session_user`.

Samson connects with `sslmode=verify-full` against the pinned Supabase Root
2021 CA. Its SHA-256 fingerprint is
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

The Supabase CLI's current dump wrapper is not used for the read-only steady
state because it forces `SET ROLE postgres`. The backup engine uses PostgreSQL
17 `pg_dump` for the granted application schemas and the guarded export function
for managed Auth/Storage rows. Roles are reconstructed from Supabase defaults
and tracked migrations unless a future provider-supported read-only role export
becomes available.

## Credential decision gate

The implementation MUST stop for explicit security approval if provider
behavior changes and the complete backup can no longer be produced through the
verified read-only boundaries. Storing the production database credential or a
full-access Supabase S3 key on Samson is not authorized by this change.

## Live Samson ownership and layout

- Proxmox guest: unprivileged LXC `104`, hostname `ax-data-archive`, DHCP address
  `192.168.88.219` at provisioning time. Treat the address as informational;
  the worker has no inbound service.
- Dataset: `samson-backup/ax-online-archive`, mounted at
  `/srv/ax-data-archive`, Zstandard compression, `atime=off`, 50 GiB quota.
- Restic repository: `/srv/ax-data-archive/restic`; current package pointers:
  `/srv/ax-data-archive/current`.
- Staging: `/var/cache/ax-data-archive`; every run uses a private temporary
  directory and removes plaintext on success, failure, SIGINT, or SIGTERM.
- Runtime state: `/var/lib/ax-data-archive`.
- Service account: `axarchive`; service credentials are individual protected
  files under `/etc/ax-data-archive/secrets`. The root-readable systemd
  environment file contains only configuration and protected-file paths;
  direct-alert values do not appear in that file or the process environment.
- Management: Samson `pct enter 104`. SSH is masked, unsolicited inbound traffic
  is dropped, and no router forwarding or Cloudflare tunnel is used.
- The existing `samson-backup/vzdump` dataset is unchanged.

Provisioning assets live in `infra/samson-data-archive`. Tool versions and
package provenance are recorded inside the guest at
`/opt/ax-data-archive/toolchain.lock` and held from unattended version changes.
The worker reads the pinned Supabase CLI provenance from this lock rather than
executing the provider CLI, which is not otherwise needed for backup operation.

## Daily operation

`ax-data-archive.timer` targets 2:00 AM `America/Los_Angeles`, persists missed
boots, and adds up to 15 minutes of randomized delay. The worker prevents
overlap with an exclusive lock. Rclone retries bounded transient object-copy
failures. `ax-data-archive-missed.timer` checks at 9:00 AM Pacific and alerts if
no verified run completed after the scheduled recovery point.

The Node entry points run with `--jitless` so they remain compatible with the
backup service's `MemoryDenyWriteExecute=true` protection. Do not remove the
memory protection to restore default JIT behavior; this I/O-heavy nightly worker
accepts the small runtime trade-off to preserve the stronger service boundary.
Its outbound storage-auth, receipt, and direct-alert calls use the pinned
pure-JavaScript HTTP client because JIT-less Node disables the WebAssembly parser
used by the built-in fetch implementation.

The S3 region must be the hosted project's actual region (`us-east-1` for this
project), not Supabase's `local` development value; Signature V4 includes the
region and rejects a mismatched setting before RLS is evaluated.

Each successful cycle:

1. records database and PostgreSQL 17 client versions plus the pinned Supabase,
   Restic, and rclone provenance;
2. exports the application roles inventory, schema, data, Auth/account rows,
   Storage metadata, and migration history;
3. obtains a fresh short-lived JWT for the app-metadata-scoped Storage reader;
4. inventories, copies, hashes, and reconciles every bucket and object twice;
5. creates stable content-addressed packages for eligible API outputs, dataset
   versions, and Tier 1/Tier 2 publications, including every referenced Storage
   object and compact database evidence identity;
6. commits encrypted Restic archive and project snapshots, runs a bounded
   repository read check, and applies 30 daily, 13 weekly, and 12 monthly
   project-snapshot retention without forgetting catalog-archive snapshots;
7. submits a signed compact receipt to Vercel and records a local success time.

An unchanged second run creates a new recovery point but Restic stores only new
chunks and reports unique bytes, compression, and deduplication. Any database,
inventory, object, checksum, archive reachability, or integrity mismatch fails
closed and leaves Supabase payloads hot.

## Status, alerts, and capacity

The receipt route stores only safe identifiers, checksums, states, counts,
sizes, timestamps, and ratios. It never stores payload bodies, filenames,
Samson addresses, local paths, recipients, credentials, or recovery keys.

When Supabase is healthy, failure receipts use the existing operational outbox.
If Supabase or the receipt route is unavailable, Samson uses the same Resend
destination with fixed templates, deterministic idempotency, a one-hour
per-event cooldown, and a six-message daily budget. High-severity capacity
bands are:

- database warning 350 MiB; critical 425 MiB;
- Storage warning 750 MiB; critical 900 MiB;
- Samson allocation warning 40 GiB; critical 45 GiB; hard quota 50 GiB.

Normal success does not consume failure-email capacity. Silence is not success:
the missed-run timer is independent of receipt delivery.

## Retention, pruning, and rehydration

`pnpm data-archive:prune:plan -- --output <protected-file>` is read-only. It
evaluates age, latest-three-valid retention, active targets, unfinished work,
candidates, publications, releases, resource sets, registry revisions, shared
Storage ownership, downstream lineage, signed receipt, integrity, and restore
evidence. Stdout contains only safe counts, bytes, reason totals, and a canonical
plan checksum.

Automatic deletion is disabled. Applying a plan requires the exact protected
file, checksum, operator identity, `--approve`, and the separate
`DATA_ARCHIVE_PRODUCTION_PRUNE_ENABLED=true` gate. The command locks and
rechecks each source, removes only named objects, records per-object state, and
never marks a package cold after partial failure. The first production prune
requires a separate owner review after the restore gates below pass.

`pnpm data-archive:rehydrate -- --package-key ... --request-key ... --owner ...
--approve` restores one exact Restic snapshot into private staging, verifies all
members, uploads collision-free hot identities, rewrites chunk manifests to
those identities, and atomically records verified rehydration. A browser never
connects to Samson. Rehydration alone never advances a dataset or publication
target; existing authorized revert/rollback checks still apply.

## Complete recovery and verification gates

Before production pruning:

1. complete one full production snapshot without deletion;
2. run a second unchanged snapshot and record actual unique bytes and ratios;
3. restore roles where supported, schema, data, Auth/accounts, migrations,
   buckets, object counts, and representative checksums into an isolated
   Supabase target;
4. pass application health checks and one API package rehydration;
5. remove temporary services and plaintext staging;
6. observe scheduled backups and alerts for an owner-reviewed period.

Quarterly drills record measured recovery point, recovery time, compressed and
unique bytes, deduplication ratio, object throughput, and manual provider setup.
Failed Restic integrity stops both pruning and retention garbage collection.

Initial non-production measurements on 2026-08-26:

- a local isolated PostgreSQL restore rebuilt one Auth account, four Storage
  buckets, one Storage metadata row, 76 migrations, the application schemas,
  and archive catalog in 802 ms from a 990,916-byte custom dump; the temporary
  database was removed afterward;
- the live guest's independent Restic fixture stored a 4 MiB unchanged payload
  twice without adding another logical copy, stored only new content for a
  changed file, restored the first and changed snapshots independently, and
  passed a complete repository read check;
- the first production recovery point on 2026-08-28 completed in about 9 minutes
  33 seconds and protected 222,370,232 database bytes plus 1,149,585,042 Storage
  bytes across 435 objects; Restic reported 20.6696x compression and the Samson
  dataset used about 66 MiB;
- the immediately repeated recovery point completed in about 9 minutes 40
  seconds, protected the same 435 objects and 1.15 GB Storage payload, and added
  only 3,870,642 unique logical bytes with a 372.4068x deduplication ratio; the
  underlying Samson dataset grew by about 0.63 MiB;
- a complete Restic read check passed, and an isolated restore reconstructed and
  verified 1.278 GiB plus all 435 manifest-listed Storage objects before the
  temporary plaintext restore was deleted.

## Credential rotation and emergency disablement

- Database reader: rotate its generated password, update only `pgpass`, run a
  manual verified backup, then revoke the old password.
- Storage reader: rotate the dedicated Auth password and its service-only file;
  do not replace it with a full-access S3 key.
- Receipt signing: set the same new random key in Vercel and the guest, deploy
  Vercel, verify one receipt, then remove the old value.
- Restic: use `restic key add`, verify the outside-Samson recovery copy, then
  remove the old repository key. Never store this key in Git, Supabase, or
  Vercel.
- Direct alert: rotate the dedicated Resend key in the guest only and send one
  fixed test alert.

Emergency stop: `systemctl disable --now ax-data-archive.timer
ax-data-archive-missed.timer`. Do not delete the repository, current package
pointers, catalog, or local state. A code rollback cannot recreate already
pruned bytes; rehydrate the exact verified package first.

## Single-site limitation

The owner currently has no off-site destination. Restic encryption, ZFS
compression, deduplication, checksums, and a two-disk mirror provide strong
local recovery and single-drive-failure tolerance. They do not protect against
fire, theft, site loss, destructive administrator action, or compromise of
Samson. Status must say `single-site` and `off-site unprotected` until a
physically separate repository is configured and restored successfully.
