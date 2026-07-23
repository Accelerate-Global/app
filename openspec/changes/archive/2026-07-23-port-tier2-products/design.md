## Context

Legacy Tier 2 chooses partner Sheets by filename/folder, maps tracking IDs through JP crosswalks, updates the shared UUID ledger, then calls a “merge” that actually concatenates rows. Aggregate 2 also concatenates Tier 2 with independently latest IMB/JP inputs. Duplicates are diagnostic only. The online replacement must make those inputs explicit and block identity ambiguity before publication.

## Goals / Non-Goals

**Goals:** durable partner profiles; exact crosswalk/resource binding; deterministic forming and identity; complete release selection; a provenance-preserving Tier 2 union and Aggregate 2 Combined Release; blocking canonical duplicates; stable publication/rollback.

**Non-Goals:** silently consolidating duplicates, separate Tier 2 UUID namespace, arbitrary partner mappings, or latest IMB/JP selection.

## Decisions

### Profiles define tracking-ID interpretation

Each partner profile binds one stable spreadsheet/tab, durable source key column, field contract, and typed `tracking_id_source`. Supported discriminator values map explicitly to JP PeopleID3, PEID, ROP3, or provider-native identity. Unknown/ambiguous values block formation; the system never guesses.

Tier 2 engine support does not create a default partner. Each intended partner
must have one active profile, exact connection/tab identity, stable key,
tracking discriminator, and reviewed contract. Unconfigured partners are
reported as unavailable and are not invented as release members.

### Preserve source ROP3 only when valid

An existing nonblank ROP3 is retained when it resolves exactly in the pinned ROP resource and agrees with approved crosswalk evidence. Invalid/conflicting existing values remain as raw evidence and create blocking findings; blank values may be filled only by one unambiguous pinned crosswalk.

### Reuse one AX registry namespace

Tier 1 and Tier 2 share counters/canonical identities. Source profile plus stable row key gives binding uniqueness. Existing identities are reused; allocation follows the same reservation/publish controls.

### Name union behavior accurately

Tier 2 release product concatenates exact identity publications in release-member order, retaining per-row provenance. Duplicate canonical PGIC is blocking and rows remain inspectable. Aggregate 2 is represented in UI/docs as **Aggregate 2 Combined Release**; it binds exact Tier 2, IMB, and JP publications and does not claim grouped aggregation. Its stable internal key remains `aggregate2`.

Partner identity publications may originate from sequential registry revisions.
The chosen final revision must be no older than every origin and must contain
every exact binding used by every member. Tier 2 and Aggregate 2 candidates also
capture their stable target's current publication at build time; publish and
rollback repeat expected-current validation inside the serialized transaction.
Each partner forming candidate likewise snapshots its exact Country, ROP, and
base registry identifiers/checksums. Its formed-source publication takes a
per-profile target lock and repeats expected-current validation in the commit
transaction, so later resource activation and competing publication cannot
change reviewed inputs or overwrite a newer target. The transition to
`publishing` also records an opaque attempt token, start time, and attempt-owned
blob path. Finalization must still own that exact token; interrupted attempts
expire after a bounded lease, return to `valid`, and clean up their orphan blob.

Tier 2 and Aggregate 2 publication authenticates the complete reviewed artifact
envelope before reading or publishing it: immutable columns, top-level manifest
checksum, the exact four artifact audit records and bodies, stored rows, output
row count, and output checksum must all agree. Final product definitions declare
workspace visibility explicitly. Normal publication applies that declaration,
while rollback preserves the stable target dataset's existing visibility as it
restores the selected immutable contents. Formed partner sources remain private.

## Risks / Trade-offs

- Partner Sheets without stable keys/configuration cannot publish → explicit correction is safer than positional identity.
- Blocking duplicates differs from legacy keep-both → prevents ambiguous canonical datasets; comparison reports explain every conflict.
- Crosswalk updates mark outputs stale → rebuild is manual and preserves historical bindings.

## Migration Plan

1. Add partner profile configuration and crosswalk resource activation.
2. Port forming/identity per partner and publish curated identity datasets.
3. Finalize a complete Tier 2 release and build/publish its union.
4. Select exact IMB/JP supplements and build/publish Aggregate 2 Combined Release.
5. Compare, approve, freeze legacy Tier 2 writers, retain read-only artifacts.

Rollback reconstructs the selected prior publication from immutable rows, stores
the incident dataset in version history, and atomically restores the stable
consumer dataset with the audited target pointer. Profiles, releases, runs,
registry history, publications, and artifacts remain preserved.

## Open Questions

None. Tier 2 shares the registry namespace; duplicate canonical codes block; Aggregate 2 uses the approved Combined Release name while retaining provenance-preserving union semantics.
