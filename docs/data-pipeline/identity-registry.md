# AX identity registry operations

AX Online is the sole authority for AX identities created after activation. It
starts with an empty registry and never reads, imports, compares, or stores AX
Data identity material. Current formed publications and the exact Country/ROP
resource versions pinned to them are the only identity inputs.

## Code and matching rules

- PGAC: `<ROP1 suffix>-<registered source initials>-<six-digit component>`.
- PGIC: PGAC plus `-<ISO3>`.
- A validated current ROP3 supplies the six-digit component. Its pinned ROP1
  parent supplies ROP1 when source ROP1 is missing.
- Without ROP3, AX Online allocates a non-recycling number beginning at
  `000001`. `00` is used only when both canonical ROP1 and ROP3 are absent.
- Exact current ROP3 reuses one PGAC across sources. Exact ROP3 plus ISO3 reuses
  one PGIC child.
- A PGAC-classified row may remain PGAC-only when ISO3 is unresolved. A
  PGIC-classified row without canonical ISO3 is unassignable and consumes no
  number.
- Missing stable source keys are unassignable. Historical or source-supplied AX
  fields are removed before matching and cannot affect allocation or output.

Forming resolves source country names/aliases to canonical ISO3 and current
ROP3 to its canonical parents. Identity assignment revalidates that evidence
against the exact pinned resources; it does not perform a second fuzzy
normalization pass.

## Initialize the empty authority

Activation is deliberately CLI-only. There is no HTTP endpoint or browser
control. The migration and activation functions fail closed unless identities,
codes, bindings, revisions, and legacy authority records are absent and the
people-groups counter is exactly `1`.

Run a dry run with an attributable actor and reason:

```text
pnpm run identity-registry:authority:local -- --environment local --actor-owner-id <uuid> --actor-email <email> --reason "Initialize fresh AX Online authority"
pnpm run identity-registry:authority:remote -- --environment production --actor-owner-id <uuid> --actor-email <email> --reason "Initialize fresh AX Online authority"
```

Review the returned attempt ID, token, state fingerprint, empty-graph checksum,
rules checksum, formatter checksum, and expiry. Commit only that exact state:

```text
pnpm run identity-registry:authority:local -- --commit --attempt-id <uuid> --token <token> --state-fingerprint <sha256>
pnpm run identity-registry:authority:remote -- --commit --attempt-id <uuid> --token <token> --state-fingerprint <sha256>
```

Commit atomically creates revision 1 with zero identities/codes/bindings and an
immutable authority marker while leaving the counter at `000001`. Any state or
contract change, token replay, nonempty graph, or second activation is rejected.
Never commit activation output or tokens to source control.

Remote activation requires the repository's verified `DATABASE_URL` transport.
Keep schedules and automatic publication disabled during activation and source
onboarding.

## Manual source onboarding

1. Ingest, form, review, and publish one current source.
2. Open `/admin/identity-registry`, enter its exact formed publication ID, and
   build a candidate. The run pins the source checksum, base registry revision,
   rule/formatter contracts, Country/ROP versions, and stable target state.
3. Review every row and finding. Reservations are not authority.
4. If an existing row's ROP1, source, ROP3, or ISO3 changed, select an allowed
   `rebind`, `new-identity`, or `canonical-supersession` decision, then build a
   new immutable candidate from those decisions.
5. Publish only a valid reviewed candidate with a reason. Publication verifies
   stored artifacts and atomically activates graph changes plus the identity
   dataset.
6. Verify the source target, registry revision, rows, checksums, and artifacts
   before onboarding the next source.

Each source profile owns `identity-<source-profile>`. Publication uses an
expected-current comparison so stale candidates cannot overwrite newer work.
If the identity graph is unchanged, a data-only publication reuses the current
revision and consumes no number. A new binding or reviewed identity change
creates a new append-only revision.

## Recovery and security

Reject or let an unpublished reservation expire; consumed values are never
recycled. After publication, corrections are forward-only reviewed revisions.
Never decrement the counter, delete identity history, silently rewrite a
binding, or restore an older database over newer authority.

All authority tables, allocator functions, activation attempts, artifacts,
findings, decisions, revisions, and publication evidence remain in private
schema/storage boundaries. Browser roles have no allocator or activation
access. Every operation records actor, reason, exact inputs, checksums, and
resulting publication/revision anchors.
