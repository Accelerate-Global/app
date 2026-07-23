# AX identity registry operations

The AX identity registry is the private, authoritative store for canonical and
alias PGAC/PGIC codes. It replaces mutable CSV/Sheet ledgers at runtime. A
formed publication is the immutable input; an identity candidate is reviewable
evidence; only an explicit administrator publication activates bindings and
creates a registry revision, identity publication, and private dataset.

New allocation and identity publication fail closed until the authoritative
legacy graph import has created the namespace cutover marker in
`private.ax_identity_registry_cutovers`. A deployed registry without that
marker is implemented but not authoritative.

## Normal operation

1. Publish a formed Tier 1 source and copy its exact publication ID.
2. Open `/admin/identity-registry`, enter that publication ID, and build a
   candidate. The run pins the formed publication/checksum, exact base registry
   revision, identity-rule checksum, Country and ROP resource version IDs, and
   both resource checksums. Those bindings remain attached to the candidate
   even if a newer resource or registry revision activates later.
3. Review assignment totals and findings. Missing/duplicate stable row keys,
   invalid ISO3/ROP components, malformed source codes, and collisions block
   publication. Reserved codes are not active registry truth.
4. Download CSV/manifest evidence if needed. Publish a valid candidate with a
   reason, or reject it with a reason. Before publication, the service verifies
   every stored artifact against its immutable checksum/size record and
   regenerates the expected CSV and manifest from the reviewed database rows.
   Publish is one database transaction: it activates bindings, snapshots the
   full active registry, writes immutable publication rows, and creates or
   replaces the private identity-enriched dataset.

Each source profile owns one stable target named `identity-<source-profile>`.
The candidate pins the publication that was current for that target when the
build began. Publication takes a per-target lock and compares that pin again in
the committing transaction. The first publication creates the dataset; later
publications replace the same dataset and archive the prior dataset version.
If another candidate wins first, the stale candidate is refused and must be
rebuilt. Candidate history labels published runs as current or prior without
rewriting either publication anchor.

Rejected and expired reservations remain in append-only history. Their
six-digit values and canonical/alias codes are never returned to the allocator.
The guarded cleanup endpoint only cancels stale reservations; it cannot delete
or recycle them. Cleanup and candidate publication share the registry advisory
lock, so stale cleanup cannot cancel a reservation while the same candidate is
being committed.

## Conflict remediation

- Correct malformed or duplicate source rows in the upstream source, publish a
  new formed version, and build a new identity candidate.
- If a source-provided AX code disagrees with the registry, treat the registry
  as canonical. Do not edit database rows or rewrite an old candidate.
- A legitimate alias or supersession needs an explicit reviewed reconciliation
  change. Never resolve a collision by changing a counter or removing history.
- If a reservation belongs to an undecided older candidate, reject or let that
  candidate expire before rebuilding. Record why the prior candidate was not
  published.

## Authoritative legacy graph import and cutover

Production cutover is a repository CLI operation, not a browser/API upload and
not a generic flat-row import. The importer is
`scripts/import-legacy-ax-identity-graph.ts`, and its default manifest is
`config/legacy-ax-identity-import-manifest.json`. That manifest fixes these five
authoritative AX Data snapshots:

| Purpose | AX Data relative path | SHA-256 | Data rows |
| --- | --- | --- | --- |
| Shared UUID ledger | `resources/AX_UUID_Ledger/20260330_204116.csv` | `b396b75dea893b36c58db3cf8c4e6fe65d8846b423ba2a8435113e997964a654` | 2,054 |
| Tier 1 UUID confirmation | `resources/AX_UUID_Tier_1/20260330_204116.csv` | `b396b75dea893b36c58db3cf8c4e6fe65d8846b423ba2a8435113e997964a654` | 2,054 |
| Tier 2 UUID subset | `resources/AX_UUID_Tier_2/20260330_204116.csv` | `2c0c31a8d122229085b06dcd8c63101e4fa51bcccb3ee8bdff5a65ef3113980a` | 1,051 |
| Shared/Tier 1 ROP3 ledger | `resources/AX_UUID/20260413_233144_AX_ROP3_CODE_LEDGER.csv` | `04cbae3b84f4ebdf71e28f0e1eef148ea0fbdb4d459f4e744d70cfd7ed83cfe1` | 294,248 |
| Tier 2 ROP3 ledger | `resources/AX_UUID_TIER2/20260121_171952_AX_ROP3_CODE_LEDGER.csv` | `e60604bed314012a3a3be8ce51f743af5d518c999b259d58361c9cd9003a4d14` | 34,675 |

The importer verifies the duplicate shared/Tier 1 UUID snapshots are
byte-identical, proves the Tier 2 UUID rows are an explicit subset, and merges
the Tier 2 ROP3 additions without treating repeated CSV rows as separate
identities. It builds one deterministic historical graph: canonical PGAC parents
contain PGIC children, while the 296,297 positional legacy row keys remain
historical binding evidence and are not staged as active source bindings. Unsafe
legacy aliases that collide with a different canonical owner are retained as
quarantine evidence and are never activated; malformed or multiply-owned
aliases remain blocking. Every Tier 2 binding must resolve through the explicit
`tier2Components.<component>.profileKey` mapping in the reviewed manifest.
The checked-in `null` profile values deliberately make the initial dry run fail
closed until administrators map every retained component to a real active profile.
Create a reviewed manifest copy that changes only those `profileKey` values and
pass it to both phases with `--manifest <path>`; do not edit the fixed file
paths, checksums, row counts, or graph expectations during mapping.
Each mapped profile must be active and used by exactly one legacy component.
For `spreadsheet:<id>` components, the profile's stored `spreadsheet_id` must
exactly equal `<id>`; an active but unrelated profile remains blocking.
The mapped profile must also use an unarchived Google Sheets connection whose
provider configuration exactly matches the stored spreadsheet and tab identity.

Profile mapping alone cannot authorize cutover. None of the 296,297 retained
legacy keys is in a proven current forming-engine namespace, and some historical
source exports collapse onto the same current row key with different identities.
The checked-in `bindingTranslation` contract is therefore immutable and set to
`blocked-pending-pinned-source-crosswalk`: it records 296,297 historical rows,
selects zero active bindings, and has no path or checksum. A CLI manifest overlay
cannot change that contract. A future repository-reviewed change must pin the
exact source snapshots, profile/connection/config and engine checksums, derive
keys through the production forming helpers, account for every historical row,
select at most one code-agreeing identity per current runtime key, and preserve
all nonselected rows as historical audit evidence. Until that implementation and
evidence exist, dry run always returns `commitToken: null` and commit always
refuses. Raw positional keys are never imported as active bindings.

The raw union contains 37,007 PGAC and 52,236 PGIC codes. Three retained
UUID/ROP3 mismatches resolve to the ROP3 identities, with the displaced three
UUID parent/child pairs preserved as six non-conflicting aliases. The resulting
historical graph covers 296,297 legacy binding rows, 37,004 PGAC parents,
52,233 PGIC children, and 89,237 total identities; the current reviewed manifest
selects zero active runtime bindings. Those mismatch decisions are
preserved as hashed audits. Three separate canonical-owner alias conflicts are
quarantined. Any different total or reconciliation count is a manifest-drift
failure.

### Dry run

Put the retained ledger files in read-only mode, preserve a backup, then run:

```text
pnpm run identity-registry:legacy-import:local
pnpm run identity-registry:legacy-import:remote
```

When using the reviewed Tier 2 mapping copy, append
`-- --manifest <path>` to the selected command. For attributable production
evidence, also supply `--actor-owner-id <owner-id>` and, when known,
`--actor-email <email>` in both phases; otherwise the CLI records its explicit
system-import actor.

Dry run is the default. It verifies every fixed path/checksum and graph
invariant without mutating registry authority. Its JSON returns `status`,
`importId`, `fingerprint`, `commitToken`, `tokenSemantics`,
`stateFingerprint`, `graphChecksum`, `reportChecksum`, `auditArtifact`, and the
full `report`.
The report contains identity counts, 296,297-row historical binding coverage,
zero selected active bindings, blocking reasons, Tier 2 mapping/connection status, and
hashed reconciliation/quarantine decisions without raw stable row keys. The
canonical audit artifact is stored with the five source snapshots, manifest,
and report in the private service-role-only `identity-registry-evidence`
bucket. `commitToken` is `null` for the checked-in blocked crosswalk contract.
Review quarantine and historical-key evidence; do not attempt to work around the
crosswalk gate with a runtime manifest. A future non-blocking implementation must
resolve every graph, code, selected-binding, checksum, source-snapshot, engine,
profile, connection, and Tier 2 mapping finding before
proceeding. `fingerprint` is an append-only execution-evidence fingerprint bound
to the repository-pinned source input, exact target database state, graph, and
report. Remediating a blocked profile or other target state therefore creates a
new dry-run record without rewriting the old evidence. The token is
deterministically bound to that fingerprint, graph, target database state, and
environment. It is reusable only for an unchanged
retry before commit; it is not a general credential and must not be committed
to source control or reused for a different state.

### Commit and authority switch

During a short legacy write freeze, rerun the matching environment command with
the dry-run fingerprint/token and an operator reason:

```text
pnpm run identity-registry:legacy-import:local:commit -- --fingerprint <sha256> --token <token> --reason "<reason>"
pnpm run identity-registry:legacy-import:remote:commit -- --fingerprint <sha256> --token <token> --reason "<reason>"
```

If dry run used `--manifest <path>`, include that same option on commit.

Commit refuses changed inputs, unresolved Tier 2 mappings, or a mismatched
handshake. With the current checked-in manifest it also refuses the unresolved
runtime crosswalk, so these commands are documented for the future reviewed
cutover rather than available today. Once that gate is implemented, commit creates
the canonical graph, one registry revision, immutable
import evidence, and the single namespace row in
`private.ax_identity_registry_cutovers`. It is
fingerprint-idempotent. The counter advances past imported values so the first
new no-ROP3 allocation is `2055`; imported allocated values cannot be reissued,
and quarantined aliases cannot become registry truth without a future explicit
reviewed reconciliation.

Successful commit JSON returns `status`, `idempotent`, `importId`,
`fingerprint`, `graphChecksum`, `reportChecksum`, and `registryRevisionId`.
Commit atomically creates the cutover marker; there is no separate finalize
step.

Confirm graph counts, revision checksum, cutover marker, allocation floor, and
sample many-binding identities before releasing the write freeze. Then run one
production identity canary from an exact formed publication, compare every
reused/new/conflicting assignment with retained legacy evidence, and rehearse
the stop-and-forward-correction path. Keep legacy files and reports read-only.
Profiles without approved mapping and canary evidence remain on their prior
path and must not be dual-written.

Remote execution also requires an official Supabase direct/pooler hostname that
matches the API project reference and a PEM `DATABASE_SSL_CA`; encryption without
server-certificate verification is rejected before any database connection.

## Rollback and recovery

Registry revisions and publications are append-only and are never rolled back
in place. Before publication, reject the candidate; its active registry state
remains unchanged. If artifact upload or publication fails, the previous
revision and dataset remain authoritative and the failed run stays auditable.
Correct the cause and build a new candidate from an exact formed publication.

After a completed publication, recovery is a forward-only correction: freeze
new publications, preserve the affected revision/publication IDs and artifacts,
create a reviewed reconcile/supersession candidate, and publish a new revision
with a reason to the same stable target. The prior dataset version and
publication remain immutable history while the correction becomes current.
Never decrement the counter, delete identities, mutate revision rows, or
restore a database dump over newer registry history.

Identity publications created sequentially will naturally cite different
origin revisions. A downstream release therefore selects one final revision
and proves that it is at least as new as each origin revision and still contains
every exact binding used by every member. It does not require all members to
have been created at the same revision.

## Security and audit boundaries

Registry, allocator, artifacts, candidate rows, findings, revisions, and
publication evidence live in the private schema/storage boundary. Browser roles
have no direct table or allocator execution access. Admin APIs use server-side
credentials and record actor, reason, timestamps, checksums, exact input
publication, resource bindings, and resulting dataset/publication/revision IDs.
