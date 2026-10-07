## Context

The parent Accelerate Global folder holds two Git repositories, supporting documents, Mac-specific environment paths and retained local Supabase volumes. `online` already supports Linux CI. Samson has existing production/recovery guests and concurrent workspace migrations, so guest identity and resources must be checked immediately before provisioning.

## Goals / Non-Goals

**Goals:** a recoverable Linux working copy with preserved refs and file identities, repeatable migration and task-worktree helpers, restricted private-network access, and a testable Cloud connection that does not depend on the Mac.

**Non-Goals:** production data mutation, pipeline publication, Vercel release, source deletion, copying Mac authentication sessions, or granting Cloud hypervisor access. Application auth metadata, RLS, public routes and UI contracts stay unchanged.

## Decisions

1. Use a fresh Ubuntu cloud image and dedicated VM, with 4 vCPUs, 16 GiB memory and 128 GiB disk when live headroom permits. Preserve existing guest identities. A per-VM Proxmox firewall on the existing LAN bridge permits DHCP/DNS, operator SSH and required outbound internet while dropping private-network egress and unsolicited ingress. This avoids altering the QA-only router source policy.
2. Keep durable files under `/srv/accelerate-global` with the original repository directory names. Preserve every local Git ref and compare hashes for transferred regular files. Do not use `rsync --delete`, force-reset another checkout or publish private material.
3. Separate active development configuration from recovery state. Encrypt legacy environment/key files and retained local database-volume packages into operator-owned Samson recovery storage outside the development guest. The ordinary Cloud development identity must not inherit production administrative secrets, even if it has privileged Docker access inside its own VM.
4. Reinstall the repo's Linux toolchain and use synthetic Supabase fixtures. Keep legacy Python publication disabled by default; store its reviewed path changes as a private Linux development configuration. Concurrency uses unique task worktrees plus a VM-local verification lock for fixed Supabase ports.
5. Prefer the supported managed VPN/raw-TCP proxy path when the account can provide its exact grant, with dedicated SSH identity and pinned host key. The qualified account cannot currently provide that grant, so use the private HTTPS job interface described in `cloud-fix-plan.md`. Tailscale Serve terminates verified TLS and stamps a scoped application capability; Cloud uses its supported HTTP proxy. The service binds only to loopback and exposes isolated file operations and fixed verification recipes. It provides no general shell or TCP-forwarding endpoint. Existing SSH helpers remain fail-closed operator tooling.
6. Enroll the new VM in backup without replacing the live job's unrelated roster. Verify a backup and isolated recovery. Keep Mac rollback copies until a real Cloud task passes independently of the Mac.

## Risks / Trade-offs

- Concurrent Samson changes → re-read live state and never reuse a guest ID on identity mismatch.
- Docker grants guest-level privilege → keep production recovery secrets outside the guest; the VM remains the project isolation boundary.
- Raw TCP unavailable in the account → use the reviewed, private HTTPS application fallback. If the supported HTTP proxy is also unavailable, report the precise current failure; do not claim cutover or substitute a public remote shell.
- DNS differs between product documentation and selected runtime → qualify the exact executor; permit a recorded `/32` transport destination first.
- Legacy paths and environment drift → generate a reviewed development configuration instead of activating copied secrets.
- Same-site backups → report this limitation; off-site acquisition remains a separate owner decision.

## Migration Plan

Plan and validate OpenSpec, implement helpers and direct negative-case tests, provision the guest, transfer verified files and refs, preserve encrypted recovery state, rebuild tools, run repo gates and existing Linux workload checks, verify guest isolation and recovery, then qualify a fresh Cloud task before declaring cutover. Rollback uses the intact Mac copy and the verified server recovery package; the migration never deletes source state.

## Open Questions

Account-owned Tailscale enrollment and Cloud configuration may require a user-mediated credential/approval step. The final Cloud proof and Mac-independent cutover cannot be marked complete without observed end-to-end evidence.
