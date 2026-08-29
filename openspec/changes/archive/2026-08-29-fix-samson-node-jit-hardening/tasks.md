## 1. Planning and Runtime Fix

- [x] 1.1 Run `pnpm run verify:change` and record the required verification lane.
- [x] 1.2 Add `--jitless` to both hardened Samson Node service entry points while retaining `MemoryDenyWriteExecute=true`.
- [x] 1.3 Update the direct unit-file regression test and operations runbook with the compatibility requirement.

## 2. Verification and Rollout

- [x] 2.1 Run the direct archive configuration test, `pnpm run spec:validate`, and every command required by `pnpm run verify:change`.
- [x] 2.2 Deploy the corrected units to Samson, reload systemd, and prove the worker starts with memory hardening retained.
- [x] 2.3 Complete two production backup runs and verify signed receipts, Restic integrity, and deduplication measurements.
- [x] 2.4 Enable and verify the 2:00 a.m. backup and missed-run timers while keeping production pruning disabled.
- [x] 2.5 Archive the completed OpenSpec change after verification.
- [x] 2.6 Ship the hotfix and confirm production release health.
