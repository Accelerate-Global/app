# Extending Reference Resources

New external identifiers, PeopleID3/PID tables, AX Registry codes, field maps,
and merge-priority resources should extend the typed lifecycle rather than add
one-off JSON loaders or mutable lookup tables.

## Adapter contract

Each resource family must define:

1. A stable catalog key, kind, label, route, and ordering.
2. Trusted source ownership and retrieval metadata. Secrets remain server-only.
3. A normalized schema with stable entry keys and explicit null semantics.
4. Blocking validation: schema, minimum counts, uniqueness, parent integrity,
   code formats, package/projection count parity, and family invariants.
5. Typed projection tables and indexes for dominant joins/searches. Do not hide
   required identifiers only inside JSONB.
6. Deterministic search text, composite cursor ordering, DTO reconstruction, and
   complete streaming CSV columns.
7. Canonical serialization and checksums plus risk-aware added/changed/removed
   diffs. Identifier removal/remap and parent changes should normally be high
   risk.
8. Raw, normalized, CSV, validation, and diff artifacts in the private bucket.
9. Bootstrap/reconciliation input and exact parity tests for counts, checksums,
   stable keys, representative rows, search fields, null behavior, and CSV.
10. Admin refresh/review/activation/rejection/history/rollback coverage and
    ordinary-user active paging/download coverage.

## Pipeline-facing rules

- A pipeline step resolves the current or explicitly selected immutable
  resource-set ID. It does not bind to arbitrary resource/version pairs.
- AX code allocation needs its own typed registry with audited used/reserved/
  retired states; it should join the lifecycle and resource-set boundary rather
  than reuse a spreadsheet as mutable state.
- Field mappings and merge priority are versioned inputs, not code branches.
  They need validation that all referenced source fields and identifiers exist.
- Forming and aggregation stages should record input dataset versions,
  resource-set ID, transformation version, counts/findings, and output checksum
  so a visualization can be reproduced.
- No adapter may weaken private-table RLS/revokes, expose artifact URLs directly,
  mutate a finalized package, silently fall back to seed JSON, or update an
  active pointer outside the audited compare-and-swap transaction.

Start with the Country/ROG and ROP adapters in
`src/lib/reference-resources/adapters.ts`, their exact generated-file parity
tests, the SQL projections in the reference-resource migration, and the pgTAP
activation/security suite. Add the catalog definition and bootstrap input in the
same change so fresh local and deployed environments converge deterministically.
