# Implementation Plans

This directory contains repository-grounded plans that are ready for a separate
implementation pass. Plans are ordered by number, not priority.

| Plan | Status | Priority | Effort | Risk | Summary |
| --- | --- | --- | --- | --- | --- |
| [001 — Unify dataset onboarding](./001-unify-dataset-onboarding.md) | Implemented and verified | P1 | L | Medium | Replace the disjointed Google Sheets and CSV entry points with one guided “Add dataset” flow, and separate onboarding from source operations. |

## Execution notes

- Plan 001 was implemented together with the completed Google Sheets visibility
  and private-tag work so the access model and guided onboarding ship as one
  coherent change.
- Do not implement a generic user-configurable API connector as part of Plan 001.
  The repository intentionally keeps generic API profiles code-managed.
- Partner-export mapping remains a post-import dataset workflow and is not part
  of onboarding.
