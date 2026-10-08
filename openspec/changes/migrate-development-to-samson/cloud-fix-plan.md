# Cloud access fix plan

## Decision

Use a private HTTPS development job API on the existing Samson VM. The published Cloud runtime has VPN enabled but no raw TCP grant, and the available configuration surface cannot add one. OpenAI documents private HTTP/HTTPS services as the supported VPN integration. This implements the HTTPS fallback already identified in the design, rather than retrying an unavailable SSH transport.

## Connection and authority

- Keep VM137, its persistent Tailscale identity, the current 90-day ephemeral Cloud enrollment key and the private environment.
- Run a standard-library Python service as `axdev`, bound only to loopback. Tailscale Serve supplies trusted TLS and a stamped application capability. No Funnel, public endpoint, route advertisement or general TCP tunnel.
- Replace the Cloud tag's TCP22 rule with TCP443 to the same VM and an `accelerate.local/cap/develop` capability. Deny SSH and other projects. Preserve every unrelated live rule.
- Require the Serve-stamped capability on every API operation. Missing, malformed or wrong-role capability fails closed. Operator SSH remains the recovery path.
- Keep the Cloud HTTP proxy and TLS verification. Use the exact VM FQDN in the environment allowlist. Remove the Cloud startup requirement for a raw SSH key; retain operator recovery material outside the image.

## API scope

The API exposes identity/revision discovery, creation of a unique detached worktree from an exact commit, bounded file listing/reads, compare-and-swap file edits, a Git diff, fixed named verification jobs, job polling/log retrieval, and creation of sanitized qualification receipts. Supporting documents and exports are readable through explicit material roots. There is no arbitrary command, arbitrary working directory, network-forwarding, credential-file, Git-push, production-publication or recursive-deletion endpoint.

Reject unsafe task IDs, missing commits, traversal, symlink escapes, forbidden credential/cache paths, stale edits, oversized requests and unknown checks. API tasks never replace existing worktrees or mutate canonical repository branches. Verification uses the VM's existing toolchain and a shared lock; Supabase work uses synthetic configuration and always stops temporary services afterward.

## Implementation and proof

1. Add server, portable client and systemd definition with direct tests covering the capability, path, concurrency and command boundaries. Run the required repo gate and install the service on VM137.
2. Verify the loopback service, unauthenticated rejection, worktree creation/edit/diff and fixed tests on the VM. Re-read the tailnet policy before replacing only this project's rule and tests. Configure Serve and inspect its effective private HTTPS configuration.
3. Update the private Cloud install/start configuration to use the HTTPS client and the exact FQDN; save and republish. Diagnose any separate upstream-proxy/permission-profile error using the supported Cloud configuration flow without changing Global or editing the immutable snapshot.
4. From a fresh Cloud task, authenticate through the managed HTTP proxy, verify VM hostname/path/revisions, create a unique worktree, perform a reversible edit, run fixed checks, and persist the receipt on Samson. Test missing capability and denied unrelated destinations. Do not use Mac-mounted files, Mac forwarding or an SSH agent.
5. Update recovery evidence, reconcile the runbook and OpenSpec tasks, and archive only after the fresh end-to-end proof and required repo checks pass. Keep Mac rollback copies; no production release is part of this fix.

## Stop condition

An unsupported or rejected Cloud HTTP policy/profile remains a real platform dependency. Record the exact current error and do not substitute an unrestricted public shell, alter the policy snapshot, or claim cutover based on a loopback/operator test.

A pending setup runtime, unavailable execution workspace or failed publication is also a platform dependency. Saving a public install-script field does not rebuild a prepared filesystem. Preserve the last working environment and record the draft/version and actual failure; a verified API workload does not prove that its corrected reusable startup was published.

Sources: [OpenAI Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments), [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [Serve command](https://tailscale.com/docs/reference/tailscale-cli/serve).
