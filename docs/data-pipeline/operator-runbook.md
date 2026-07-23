# Data pipeline operator runbook

This runbook is the operating contract for AX Online ingestion, forming,
identity, release, Tier 1, Tier 2, Aggregate 1, and Aggregate 2 flows. AX Data is
not a runtime dependency. Its retained files are used only as explicit,
checksummed migration inputs and read-only comparison evidence.

## What is implemented versus what must be configured

Code support and environment configuration are different states. A deployed
engine does not make a source runnable until its provider, profile, resources,
and required secret are available in that environment.

| Flow | Implemented support | Required environment configuration |
| --- | --- | --- |
| IMB people groups | Code-managed ArcGIS connection and source-forming engine | No profile binding; verify provider reachability. |
| Etnopedia people groups | Code-managed MediaWiki connection and source-forming engine | No profile binding; verify provider reachability. |
| Joshua Project people groups | Code-managed HTTPS connection and source-forming engine | The Joshua Project API secret must be configured. |
| Accelerate-owned people groups | Google Sheets source-forming engine | Bind one active Sheet/tab connection to `accelerate-owned-people-groups` and select a durable stable-key column. |
| World Christian Database | Google Sheets source-forming engine | Bind one active Sheet/tab connection to `wcd-people-groups` and select a durable stable-key column. |
| Tier 2 engagement partners | Profile-specific Sheet forming, identity, release, and schedule support | Create one active profile per partner with exact spreadsheet/tab identity, stable key, tracking discriminator, and contract. No partner profile is implied by deployment. |
| Tier 1, Aggregate 1, Tier 2, Aggregate 2 | Code-defined product and publication definitions | Exact upstream publications, healthy resources, and registry revisions must exist before a release can finalize. |
| Scheduling | Authenticated bounded continuation and per-profile Tier 2 schedule support | Schedules start disabled. Each schedule requires its own matching successful manual production canary. |

Use the Connections, Resources, Identity Registry, Pipeline Products, Tier 2
Products, and Pipelines admin pages to verify the actual environment state. Do
not infer configuration from this table.

## Exact launch snapshot

A normal manual launch captures current inputs once, before execution, in a
repeatable-read snapshot. The run stores the resulting input fingerprint and
exact values, including:

- source-profile connection IDs, stable-key configuration, configuration
  checksum, and update timestamp;
- the immutable reference-resource set ID/checksum and every member
  version/checksum;
- retained formed, identity, and product publication IDs/checksums;
- the selected AX registry revision ID/checksum;
- the Tier 1 priority version/checksum and full parsed priority rules;
- active Tier 2 profile IDs, connection IDs, contract checksums, and update
  timestamps;
- Tier 2 contract-resource versions/checksums; and
- each stable product target's expected current publication ID.

Stages consume this stored snapshot plus immutable outputs from prior stages.
They do not re-resolve a resource, profile, parent, rule, or publication as
“latest” while the run is executing. **Rebuild with current resources** is an
explicit request for a new run and a new snapshot; it never changes the old
run. Historical backfill requires explicit UUID/checksum bindings and rejects
`current` or `latest` aliases.

## Review-and-publish lifecycle

1. **Ingest.** The existing connection lifecycle stores checksummed raw and
   parsed source artifacts. Successful ingestion is evidence, not a curated
   dataset.
2. **Form.** The selected engine verifies its pinned profile, resource set,
   resource versions, field/type contracts, transformation checksum, and
   source checksum before producing ordered rows, findings, artifacts, and an
   output checksum.
3. **Review.** The coordinator stops at a durable review stage. Inspect exact
   inputs, row/finding totals, downloads, and attempt history. Warnings require
   acknowledgement; errors cannot be approved.
4. **Publish formed source.** An approved source candidate publishes one
   immutable formed publication and updates its stable dataset through the
   prepared-dataset transaction. A failed storage or database write cannot
   create a false published state.
5. **Reconcile identity.** The identity stage consumes that exact formed
   publication, pinned Country/ROP versions, and an exact base registry
   revision. Reservations are reviewable but not authoritative.
6. **Publish identity.** Approval activates bindings, creates the next complete
   registry revision, creates an immutable identity publication, and writes the
   identity-enriched dataset atomically. Rejected/expired reservation numbers
   are never recycled.
7. **Finalize release.** Tier 1 or Tier 2 finalization verifies exact member
   checksums, archived row counts, profile membership, resource/rule bindings,
   and compatibility with one selected final registry revision.
8. **Build and review product.** Merge and aggregate definitions create private
   deterministic candidates with provenance, findings, comparison evidence,
   and output checksums.
9. **Publish product.** Publication rechecks the candidate and compares the
   stable target with the target ID captured at build time. If another publish
   advanced the target, compare-and-swap validation rejects the stale publish
   instead of overwriting the newer result.

Every rejection requires a reason and invokes the domain candidate's rejection
operation before the coordinator closes the flow. This preserves artifacts and
findings, cancels identity reservations without recycling values, and prevents
later publication stages from running. Invalid profiles, incompatible release
members, stale definitions, unsupported schedules, and target races are also
rejected with controlled domain errors and no partial mutation.

## Reference resources

Seven immutable resource families participate in current pipeline formation:

1. Country and territory codes;
2. ROP hierarchy codes;
3. source registry and aliases;
4. Joshua Project PeopleID3 crosswalks;
5. PEID crosswalks;
6. Tier 1 merge priorities; and
7. engagement field/template mappings.

Field, type, transformation, aggregate, and scope rules that are maintained in
code still carry explicit versions and deterministic checksums. They are pinned
alongside catalog resources but are not represented as mutable uploaded files.

### Import the complete retained snapshots

The source-alias, PeopleID3, PEID, merge-priority, and engagement-mapping
packages are imported from five exact retained AX Data CSVs. The built-in
manifest fixes each relative path, SHA-256 checksum, and retrieval timestamp;
the importer rejects checksum drift and never searches for a newest file.

| Resource | Exact AX Data path | SHA-256 |
| --- | --- | --- |
| Source aliases | `resources/Database_Sources/20260330_204117.csv` | `1f55e3be68dadd4e99df8837357305f05024833b75b2a06c870ae6b677033f0a` |
| JP PeopleID3 | `resources/jp/peopleid3/20260330_204114.csv` | `eeb4e3f4c7effe3e957334b8590409d9ecbf4303ddc4676750cd78e9a4d5f1f8` |
| PEID | `resources/PEID/20260330_204115.csv` | `d4faef4315a42e6034c9e8352f4856de6fd589ea2234688f109ec3479a0b9cde` |
| Tier 1 priorities | `resources/data_priority_agg_1/20260330_204115.csv` | `d498814f3f5c037b8bcbd65f772142cab5afb1ea3402ace86e384bdac6fea87f` |
| Engagement mappings | `resources/engagement_template/20260128_122551.csv` | `c3195329a0d7e7d1591abb77190fe2397ddea53f4bc210ba15663c31038d2921` |

After Country/ROP bootstrap, use the repository commands:

```text
pnpm run pipeline-resources:import:local
pnpm run pipeline-resources:import:remote
```

For a reviewed replacement snapshot, call the importer directly with one
explicit AX Data root and a JSON manifest containing all five resource keys,
each with `resourceKey`, `relativePath`, `sha256`, and `sourceRetrievedAt`:

```text
node --import tsx scripts/import-pipeline-reference-resources.ts --remote --ax-data-root /absolute/path/to/data --manifest /absolute/path/to/reviewed-manifest.json
```

Both the environment and root are required. A partial manifest, unexpected
resource key, path outside that root, invalid checksum, or changed file bytes
fails before candidate creation; there is no timestamp, mtime, glob, or
“latest” fallback.

The importer reads and validates all five complete snapshots before activating
any candidate. It records source-file checksum, validation resource-set
ID/checksum, validation lineage, full typed payload, findings, entry count, and
content checksum on immutable versions. Only valid candidates are activated.
Activation uses expected-current checks, creates new immutable resource sets,
and finishes with an all-resource health check. Sanitized fixture packages are
for local bootstrap and tests; they are not production substitutes.

`pnpm run db:push:remote` applies migrations, bootstraps core Country/ROP,
imports the checksum-pinned full pipeline resources, and then verifies normal
resource bootstrap health. This command is a deployment/migration operation,
not a runtime application dependency.

Activating a newer version affects only new launch snapshots. Existing runs,
candidates, publications, and releases retain their exact prior bindings and
may become visibly out of date. Roll back the active resource pointer to a
reviewed older version; never edit or delete a finalized resource package.

## Named flows and required order

### Tier 1

The source definitions `source-imb-people-groups`,
`source-etnopedia-people-groups`, `source-joshua-project-pgic`,
`source-wcd-people-groups`, and `source-accelerate-owned-people-groups` perform
ingestion → forming → review → formed-source publication. They do not silently
activate AX identities.

Use the Identity Registry page for individual source identity work, or use the
`tier1-full` definition after all five sources are configured. `tier1-full`
runs each source through forming and identity review/publication, then pauses
for exact release review before building both Tier 1 merges and all Aggregate 1
products. `tier1-release` starts from already published identity inputs.

Sequential identity publications naturally originate from different registry
revisions. Choose the final revision produced after the last source. Release
finalization accepts an earlier source publication only when that final
revision is not older and contains every exact binding used by the source
publication. A superseded or missing binding remains blocking.

See [Tier 1 and Aggregate 1 product operations](tier1-products.md) for product
order and recovery.

### Tier 2 and Aggregate 2

Run `tier2-partner` separately for each active partner profile. It pins that
profile, ingests its exact connection, forms, pauses for review, publishes the
formed source, reconciles identity, pauses again, and publishes its identity
output.

After every active partner has one reviewed identity publication, run
`tier2-release`. It pauses for release membership review, finalizes the exact
partner release, builds/reviews/publishes the Tier 2 provenance-preserving
union, then builds/reviews/publishes **Aggregate 2 Combined Release** from the
exact Tier 2, IMB, and JP publications captured for the run.

See [Tier 2 partner and product operations](tier2-products.md) for profile and
conflict details.

## Pipeline operations

Open `/admin/pipeline-operations` to launch a code-defined flow and inspect its
history. Each run exposes correlation ID, launch kind, exact inputs, stage
timeline, bounded attempts, safe diagnostics, counts, findings, actor,
publication IDs, and current/out-of-date state.

### Retry and stale-lease recovery

- A worker claims one stage with a time-bounded lease and heartbeats while it
  works. Duplicate continuations cannot claim the same active stage.
- The authenticated internal continuation recovers expired stage leases and
  stale product-publication attempts before advancing a bounded number of
  queued stages.
- Recovery retains the interrupted attempt, records a new attempt, and uses the
  stage's idempotency fingerprint. Partial or unverified artifacts are not
  promoted as complete output.
- Retry is available only for a retryable failed stage and requires a reason.
  Exhausted/non-retryable failures require correction and a new rebuild.
- A run whose definition version/checksum no longer matches deployed code
  cannot resume through an old review gate. Rebuild it with current inputs.

### Scheduling and canaries

The Vercel cron invokes `/api/internal/pipeline-operations/run` daily at 17:00
UTC. The route requires schedule authentication, recovers stale work, advances
bounded queued work, and enqueues only due enabled schedules. The cron's existence
does not mean any data-source schedule is enabled.

Schedule rules are deliberately strict:

- only definitions marked schedule-eligible can be configured;
- each schedule must reference a successful **manual** canary for the same
  definition version and checksum;
- a Tier 2 schedule is scoped to one exact active partner profile, and its
  canary must have pinned that same profile ID;
- each Tier 2 profile has an independent interval, canary, enablement, and
  last-enqueued time;
- deactivating the profile removes it from due schedules; and
- deploying a changed flow definition invalidates the old canary until a new
  successful manual canary is recorded.

Scheduled source work still pauses at every review gate. Scheduling never
acknowledges warnings, activates identities, finalizes a release, or publishes
a dataset automatically.

## Production canary checklist

Before enabling any matching schedule or disabling a legacy writer:

1. Apply migrations and import the complete checksum-verified resource
   snapshots.
2. Before any identity stage, complete the fixed-manifest graph dry run,
   resolve every explicit Tier 2 profile mapping, freeze the legacy identity
   writer, commit the matching fingerprint/token, and verify the registry
   cutover marker and allocation floor. Follow
   [AX identity registry operations](identity-registry.md).
3. Verify the deployed profile is actually configured, readable, and bound to
   the intended stable key; verify required secrets without exposing them.
4. Launch the named flow manually from Pipelines. For `tier2-partner`, select
   and record the exact partner profile.
5. At every review gate, compare counts, findings, checksums, identity reuse/new
   allocations, release membership, field winners, provenance, and aggregate
   totals. For Tier 2 and Aggregate 2, attach the final AX Data rows JSON to the
   exact completed candidate in **Legacy side-by-side comparison**, review all
   retained/dropped/added/conflicting outcomes, and download the immutable
   `comparison-json` report before approval.
6. Approve and publish only after every unexplained difference is resolved.
7. Verify the live stable dataset target, publication ID, row count, output
   checksum, current/out-of-date state, and download artifacts.
8. Exercise the applicable target-aware rollback against an exact retained
   publication and reviewed current publication, then verify the appended
   rollback run/publication and live target. Do not use generic dataset
   replacement or upload-history revert for pipeline-managed targets. Record
   the canary run ID and owner approval.
9. Only then enable the schedule that exactly matches that definition/profile.

Run a manual canary for every registered source/product flow used in the
cutover, including both complete release definitions. Component tests or one
successful source do not qualify as a canary for another definition/profile.

## Legacy freeze and read-only cutover

1. Preserve the final legacy input, identity-ledger, merge, and aggregate
   snapshots with paths, timestamps, sizes, and SHA-256 checksums. Attach the
   final legacy rows snapshot to the exact online candidate and preserve the
   resulting downloaded comparison report with the same evidence inventory.
2. Dry-run and commit the identity import according to
   [AX identity registry operations](identity-registry.md).
3. Shadow-build AX Online from the same retained evidence and obtain owner
   approval for every intentional difference.
4. Freeze the corresponding AX Data writer immediately before the first AX
   Online authoritative publication. Do not dual-write identity ledgers or
   publication targets.
5. Keep legacy scripts, Sheets/files, ledgers, and reconciliation reports
   read-only and access-controlled for audit. Do not delete them as part of
   application deployment.
6. Disable the legacy writer permanently only after the online canary, live
   target verification, and rollback rehearsal pass for that exact flow.

The identity ledger is the global exception to per-flow timing: its legacy
writer is frozen before the verified graph commit, and it must not resume after
the immutable registry cutover marker exists. All later identity corrections
are forward-only AX Online revisions.

Unconfigured profiles are not cut over. Their legacy writer remains unchanged
until the profile, resources, canary, approval, and rollback requirements are
satisfied.

## Deployment and rollback

Deployment order is migrations → compatible application → core resources →
exact pipeline resources → fixed identity-graph dry run → legacy identity
writer freeze and atomic graph cutover → production flow canaries → optional
schedules → per-flow legacy writer freeze/disable. Pass the repository's
current change gate, archive all active OpenSpec changes, and pass the pre-ship
gate before release.

Rollback depends on the affected boundary:

- **Application:** redeploy the previous migration-compatible application.
  Additive private metadata and immutable artifacts remain preserved.
- **Resource:** move the audited active pointer to a prior valid immutable
  version. Existing runs remain unchanged.
- **Formed source:** rebuild from retained exact lineage, review it, and publish
  a new auditable version through the owning source-forming flow.
- **Tier 1 or Aggregate 1:** call the target-aware Pipeline Products rollback
  with the exact retained publication, reviewed current publication, and
  reason. It verifies immutable evidence, restores the stable dataset, and
  appends a new rollback run/publication. Generic dataset replacement or
  row-batch upload, status/visibility mutation, backing-dataset assignment,
  and upload-history revert are blocked for pipeline-managed datasets; version
  history remains read-only evidence.
- **Tier 2 or Aggregate 2:** advance the stable target to a prior publication
  only when the caller's expected-current publication still matches.
- **Identity:** stop new publication and make a forward-only reviewed
  correction. Never decrement the counter, recycle values, delete bindings, or
  overwrite a newer registry revision with a database restore.
- **Schedule:** disable the exact definition/profile schedule. Existing
  awaiting-review evidence remains available and cannot auto-publish.

## Stop conditions

Stop publication and keep schedules disabled when a required profile is
unconfigured, a provider/secret is unavailable, a resource is unhealthy, an
exact checksum or row count differs, a run definition is stale, identity is
conflicted, a release is incomplete, the chosen registry revision lacks a
binding, a stable target has advanced since review, an unexplained legacy
difference remains, or storage/database state cannot prove an atomic outcome.
