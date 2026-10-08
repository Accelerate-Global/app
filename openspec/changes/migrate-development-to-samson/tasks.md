## 1. Plan and implement portable tooling

- [x] 1.1 Run `pnpm run verify:change` and scoped `task:kickoff`; create the proposal, design and testable migration spec.
- [x] 1.2 Add inventory/checksum, transfer selection, Cloud-policy validation and safe task-worktree helpers with direct failure-case tests.
- [x] 1.3 Add dedicated VM/toolchain configuration and an operator/Cloud runbook; run direct syntax checks and `pnpm run spec:validate`.

## 2. Provision and migrate

- [x] 2.1 Recheck Samson resources and unused identity; provision a fresh guest with verified source image, dedicated keys and qualified guest isolation.
- [x] 2.2 Transfer both repositories and supporting material; verify digests and every retained local Git ref.
- [x] 2.3 Preserve legacy secrets and local Supabase volumes in encrypted operator-only recovery storage; rebuild safe Linux development configuration and tools.
- [x] 2.4 Run existing app/Python qualification on Linux and required tracked-tree checks from `verify:change`; stop temporary services and clean transient Docker cache.
- [x] 2.5 Correct the stale private-data Tier 2 runner mock and verify its explicit selection and source-only timestamp/flag contract; rerun the Python suite.

## 3. Recovery and Cloud qualification

- [x] 3.1 Enroll the development guest in backup and verify backup integrity plus an isolated restore and guest reboot.
- [x] 3.2 Configure the dedicated Tailscale/Cloud identities and exact destination grants; prove authenticated Cloud access and denied unrelated access.
- [x] 3.3 Prove a fresh Cloud task can edit and verify a task worktree independently of the Mac; record the qualified API workload evidence while retaining rollback copies.
- [x] 3.4 Run `pnpm run verify:change:run`, reconcile the operations receipt and update the parent assessment. Keep the change active until the reusable startup/publication tasks also pass; then archive after required final verification. No ship or production release is requested.

## 4. Supported HTTPS connection fix

- [x] 4.1 Record the fallback plan and update the capability contract; implement the bounded server/client/service and direct negative boundary tests.
- [x] 4.2 Pass the repo gate, install the VM service and verify loopback authorization, worktree edits, fixed checks and persistence.
- [ ] 4.3 Replace only this Cloud identity's SSH grant with the private HTTPS capability; configure Serve and republish the private Cloud environment with the HTTPS client/start workflow.
- [ ] 4.4 Qualify the corrected published startup and installed client through the actual managed HTTP proxy, persist its receipt and reconcile recovery. The first API workload proof closes 3.2/3.3, but does not close this reusable-startup gate.

Tasks 3.2/3.3 passed in fresh Cloud task `01a119bc-499b-75e3-a38b-d9c9aaa95010`; its API workload receipt is on Samson. Tasks 4.3/4.4 remain blocked by reusable setup: the old snapshot lacks the client, while the corrected draft has sole-URL requirements and a hash-checked startup bootstrap but stays pending without an execution workspace and fails publication. The latest saved draft is `01a119cc-09c3-701b-b7c7-d143c2c140e6`, revision 4. Do not archive or claim reusable startup passed from the successful workload test alone.
