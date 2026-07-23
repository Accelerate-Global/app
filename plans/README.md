# Implementation Plans

This directory contains repository-grounded plans that are ready for a separate
implementation pass. Plans are ordered by number, not priority.

| Plan | Status | Priority | Effort | Risk | Summary |
| --- | --- | --- | --- | --- | --- |
| [001 — Unify dataset onboarding](./001-unify-dataset-onboarding.md) | Implemented and verified | P1 | L | Medium | Replace the disjointed Google Sheets and CSV entry points with one guided “Add dataset” flow, and separate onboarding from source operations. |
| [002 — Port all data pipelines](./002-port-all-data-pipelines.md) | Implementation and release verification in progress | P1 | L (multi-wave) | High | Port all remaining AX Data ingestion, forming, AX identity, Tier 1/Tier 2 merge, Aggregate 1/Aggregate 2, and explicit publication flows into versioned AX Online workflows. |

## Execution notes

- Plan 001 was implemented together with the completed Google Sheets visibility
  and private-tag work so the access model and guided onboarding ship as one
  coherent change.
- Do not implement a generic user-configurable API connector as part of Plan 001.
  The repository intentionally keeps generic API profiles code-managed.
- Partner-export mapping remains a post-import dataset workflow and is not part
  of onboarding.
- Plan 002's dependency order remains authoritative: shared forming precedes
  source ports; source publication precedes AX identity; identity precedes
  merges and aggregates. The current authorized delivery coordinates that work
  as six linked OpenSpec changes on one branch instead of separate pull
  requests. Completion still requires the full local gate, remote migrations,
  production canaries, rollback rehearsal, and controlled legacy cutover.
