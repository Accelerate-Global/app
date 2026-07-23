## Context

The production legacy identity graph is defined by a checked-in manifest, but its five source ledgers intentionally live in the sibling AX Data repository. A Vitest case read those paths unconditionally, making the required GitHub test suite depend on developer-local data. The importer already has a compact checked-in synthetic graph that exercises reconciliation behavior without exposing production records.

## Goals / Non-Goals

**Goals:**

- Keep required CI deterministic and self-contained.
- Preserve continuous coverage for audit hashes, redaction, checksums, and reconciliation decisions.
- Preserve full-ledger validation in the explicit checksummed legacy-import workflow.
- Keep all production identity data outside this repository.

**Non-Goals:**

- Changing identity allocation, reconciliation, publication, or cutover behavior.
- Replacing the production manifest with synthetic values.
- Fetching private ledgers in GitHub Actions or adding new secrets and storage.

## Decisions

1. The committed synthetic graph will carry the security and determinism assertions that must always run. This validates the importer contract rather than a particular workstation layout.
2. Production inventory and reconciliation totals will remain unconditional assertions against the checked-in manifest. The explicit legacy-import workflow remains responsible for reading the five real ledgers, verifying their checksums and row counts, and comparing calculated outcomes to those manifest expectations.
3. No test will conditionally skip based on a workstation path. The required suite will have identical behavior in clean checkouts and developer machines.
4. No production rows or derived row-level audit artifact will be committed. The existing synthetic fixture is sufficient to prove row-key hashing and redaction.

## Risks / Trade-offs

- [Risk] GitHub cannot detect drift between private production ledger contents and the pinned manifest. → Mitigation: the manifest paths, checksums, and characterized inventory remain version-controlled, and the explicit import workflow fails closed on any checksum, row-count, or reconciliation mismatch before it can create authority.
- [Risk] A future test may accidentally add another sibling-data dependency. → Mitigation: the delta contract states that required CI characterization must be backed by committed sanitized fixtures.
