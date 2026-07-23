## Context

Legacy identity has two paths: deterministic ROP3 formulas and sequential six-digit UUID values. Both are keyed to source `Dataset_Row_Key`; the old ledgers have no transaction isolation, uniqueness enforcement, revision anchor, or reliable alias constraint. Online source forming now produces stable profile/row keys and immutable publication evidence suitable for reconciliation.

## Goals / Non-Goals

**Goals:** unique/idempotent allocation; canonical/alias collision prevention; non-recycling six-digit values; stable source bindings; explicit candidate review/publication; legacy import with conflict refusal; exact registry revisions for downstream release sets.

**Non-Goals:** name-based matching, automatic conflict repair, recycling cancelled values, arbitrary browser editing, merge/aggregate execution.

## Decisions

### Model PGAC parents and PGIC children

`ax_identities` stores PGAC or PGIC subjects. PGIC requires a PGAC parent and normalized ISO3. `ax_identity_codes` stores canonical and alias values in one table so a code cannot be canonical for one identity and alias another. Active PGIC is unique by parent+ISO3; allocated number is globally non-recycled within namespace.

### Preserve formulas while hardening inputs

ROP3-based PGAC is `last2(ROP1)-sourceInitials-sixDigit(ROP3)` and PGIC appends normalized ISO3. Missing ROP1 uses `00`; unknown source aliases and missing ISO3 are blocking rather than emitting `xx`/`XXX` in a new canonical code. ROP3 parsing is strict against the pinned resource. Existing code values may be retained only when structurally valid, globally collision-free, and explicitly reconciled.

No-ROP3 identity uses the same PGAC/PGIC shape with an allocated six-digit component. A private function locks by namespace/profile/key, reuses an existing reserved/active binding idempotently, and increments a bounded counter with `UPDATE ... RETURNING`. Values are never computed with `max()` and never recycled.

### Reserve during candidate build, activate during publish

Identity builds may create expiring reservations. The candidate records reused, retained, newly reserved, conflicting, and unassignable rows. Rejection or expiry cancels reservations but does not recycle allocated values. Publish atomically activates bindings, creates one immutable registry revision and publication anchor, and produces the identity-enriched source dataset. The formed source candidate remains unchanged.

Each candidate stores the exact formed publication/checksum, base registry
revision, identity-rule checksum, and Country/ROP resource version IDs and
checksums captured at build start. Reservation cleanup and publication acquire
the same registry advisory lock, so cleanup cannot cancel a reservation while
its candidate is committing. A later resource or registry revision never
rewrites the stored candidate inputs.

Each source profile also owns one stable identity publication target. A build
pins the target's current publication ID (or null before its first publication).
Publish uses a per-target advisory lock and commit-time compare-and-swap; a
stale candidate cannot overwrite a newer winner. The first publication creates
the private dataset and later publications replace that same dataset through
normal dataset version archival. A bounded attempt lease prevents a recovered
publisher from committing after ownership is lost.

Artifact evidence is verified before any publication claim. Stored rows,
findings, manifest, and CSV must match their immutable checksum/size records,
and the manifest and CSV must equal deterministic regeneration from reviewed
candidate rows. A mismatched blob leaves the prior target unchanged.

### Import one authoritative legacy identity graph

Production import uses a repository-owned manifest that fixes every retained AX
Data snapshot path and SHA-256 checksum. The importer validates the whole graph
as PGAC parent → PGIC child plus complete historical row-key evidence, rather
than treating each CSV row as an independent identity. It reconciles
byte-identical/shared ledgers, requires explicit Tier 2 source-profile mapping
and an active exact-match source connection, and fails closed when a Tier 2
binding cannot be mapped. A structurally valid legacy alias that collides with
a different canonical owner is retained as quarantine evidence and never
activated; malformed or multiply-owned aliases remain blocking.

The CLI runs dry by default and returns a target-state-bound evidence
fingerprint plus a commit token. Snapshots, the canonical manifest, report, and
hashed reconciliation decisions are retained in a private service-role-only
evidence bucket. Commit requires both values, the identical reviewed overlay,
and an operator reason. The database binds authorization to one transaction,
guards every staged graph table, and recomputes the exact graph and audit
checksums before it atomically creates one registry revision and durable
cutover marker. A changed target state produces a new append-only dry run and
invalidates the old token. The counter advances to `2055` so imported values
cannot be reissued. The browser/API flat-row importer is not a production
cutover path. The importer never searches for latest filenames or accesses
Drive.

The retained 296,297 legacy row keys are positional historical evidence, not
current forming keys. Corpus analysis also found source-export collapses where
multiple historical rows map to one prospective runtime key, including
different canonical identities. The checked-in manifest therefore fixes an
immutable `blocked-pending-pinned-source-crosswalk` contract with 296,297 raw
rows and zero selected active bindings. Runtime manifest overlays cannot change
it, and raw keys are never staged. A future repository-reviewed cutover change
must pin exact source-unit snapshots and their checksums, profile/connection/
configuration plus engine contract checksums, recompute keys with production
forming helpers, account for every historical row, and select no more than one
code-agreeing identity for each unique current key. Nonselected rows remain
immutable historical evidence; different-identity collisions remain blocking.

### Give downstream stages a publication/revision anchor

Append-only `pipeline_publications` identifies the exact producer run, dataset, output checksum, row count, and artifacts immediately, rather than relying on `dataset_versions.id` that exists only after a later replacement. Downstream release sets bind publication IDs plus one registry revision.

Because sources publish sequentially, their identity publications may cite
different origin revisions. A release selects a final revision that is not
older than any origin and proves it contains every exact binding used by every
member; requiring identical origin revisions would make coordinated releases
impossible.

## Risks / Trade-offs

- Strict source aliases/ISO3 reject legacy fallback codes → safer than creating noncanonical identities; conflicts remain reviewable.
- Reservations consume values even when cancelled → intentional non-recycling preserves audit and prevents later ambiguity.
- Imported ledgers may contain irreconcilable collisions → importer stops before mutation and produces a remediation report.
- Identity publish spans registry and dataset writes → storage is prepared first; one DB transaction replaces the stable dataset and activates bindings/publication evidence, with attempt-scoped storage cleanup on failure.

## Migration Plan

1. Add private tables/functions/constraints/RLS and local security/concurrency tests.
2. Add pure formula/allocation policy and candidate lifecycle.
3. Dry-run the fixed legacy graph manifest, resolve every blocking graph or
   Tier 2 mapping finding, review quarantined aliases, and commit only with the
   matching fingerprint/token and reason.
4. Reconcile all published Tier 1 formed rows by stable profile/key, build candidates, and compare assignments.
5. Freeze legacy writers, verify the registry cutover marker, publish identity
   revisions/datasets, and retain read-only ledger snapshots and reports.

Rollback stops new allocation/publication and restores prior identity-enriched dataset versions; registry history, used numbers, source bindings, and artifacts remain immutable.

## Open Questions

None. Tier 1 and Tier 2 share the authoritative numeric namespace; source/profile keys distinguish bindings, and no allocated value is recycled.
