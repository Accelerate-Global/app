# Samson development workspace

The dedicated `accelerate-dev` Linux guest holds Accelerate Global's app, private data repository and supporting files under `/srv/accelerate-global`. The source Mac remains a rollback copy until a fresh Codex Cloud task has passed the private connection and workload checks independently of the Mac. Migration does not enable production publication or change hosted Vercel/Supabase behavior.

## Operator and task boundaries

`axops` is the dedicated operator account. `axdev` owns development files and has Docker access within this project VM. Docker grants effective guest-level privilege, so legacy production credentials and database recovery packages belong in encrypted storage outside this guest. No Cloud identity receives Proxmox credentials or access to another project.

Use one task worktree per exact commit. Serialize Supabase-dependent verification with `flock /srv/accelerate-global/.verification.lock`. Run normal planning and terminal gates from the selected checkout; apply the existing Docker shutdown/cache-cleanup policy afterward. Resolve historical Mac path references against that checkout.

## Migration helpers

The helpers under `infra/samson-development` use Python's standard library and OpenSSH. They inspect before acting and reject unsafe paths, file mismatches and unpinned access.

```bash
python3 -B infra/samson-development/workspace.py inventory --root <source-parent> --output <new-protected-manifest>
python3 -B infra/samson-development/transfer.py --source <source-parent> --manifest <manifest> --host <guest-ip> --key <operator-key> --known-hosts <pinned-hosts>
```

The transfer defaults to dry run. Add `--apply` only for the reviewed destination. It streams an explicit regular-file tar manifest through pinned SSH and never removes source or destination files. This avoids the observed protocol-29 manifest stall in macOS `openrsync`. Copy the manifest privately, then run `workspace.py verify` against `/srv/accelerate-global` before intentionally rewriting development configuration. Preserve every Git ref and exact revision. Disable copied Mac Git filesystem-monitor settings after verification.

`provision.py` runs on Samson with an operator-owned non-secret JSON configuration containing the unused guest ID, guest address/MAC, pinned image path/checksum, public-key files and installation script. Its default mode checks identity and headroom without mutation. `--apply` creates only a fresh guest; existing identities require operator inspection rather than automatic replacement. Guest firewall rules are compiled before the NIC is connected.

`install-tools.sh` installs the checked Node 22 toolchain, pnpm 10, the repository's Supabase CLI and Tailscale. Install application/Python dependencies from their checked-in lock/requirements files and the repo's Chromium version. Tailscale installation is separate from enrollment.

The data configuration sets `SPEC_OUTPUT_DIR` to `/srv/accelerate-global/data`: `resources/spec_sheet.py` appends `resources/**` itself. Keep stage-specific pipeline output defaults; use `/srv/accelerate-global/exports` for explicit standalone exports. Recreate Supabase's `.temp` cache locally so a copied production project link cannot become active.

Run helper tests before use:

```bash
python3 -B -m unittest discover -s infra/samson-development -p '*_test.py' -v
bash -n infra/samson-development/cloud-ssh.sh
bash -n infra/samson-development/install-tools.sh
```

## Cloud setup

Create a private Cloud environment for the intended repositories. Add the dedicated Tailscale VPN connection in Advanced settings and allow only its required destinations. Cloud's enrollment key is reusable and ephemeral; the guest's persistent node uses its own identity. Review the effective tailnet policy: broad existing grants can defeat a narrow new grant. Restrict the Cloud source tag to this guest's TCP22 and preserve operator access separately. Do not advertise subnet routes, create an exit node or expose the Codex app server publicly.

The current private environment is **Accelerate Global Samson**. VM 137 is enrolled as `accelerate-dev.tail13a215.ts.net`, IPv4 `100.79.143.121`, with `tag:accelerate-dev` and node-key expiry disabled. Cloud enrollment uses `tag:accelerate-cloud`, a reusable ephemeral auth key with the maximum 90-day lifetime, expiring January 4, 2027. Renew that environment's enrollment key before expiry; this deadline governs new Cloud enrollment and does not expire the persistent tagged VM. The saved tailnet policy permits this Cloud tag only to the guest's TCP22 and includes explicit denial tests for other ports, infrastructure and project guests.

Before use, inspect the selected Cloud runtime policy and qualify its TCP CONNECT path. Supply these non-secret selectors:

```text
AX_CLOUD_TARGET=<authorized-private-ipv4-or-hostname>
AX_CLOUD_KEY_FILE=<owner-only-runtime-dedicated-key-file>
AX_CLOUD_KNOWN_HOSTS=<out-of-band-pinned-host-key-file>
AX_CLOUD_SOCAT=<maintained-runtime-socat-executable>
```

Use the runtime's supported socat installer. Its downloads may need the exact vendor host allowed in HTTP policy. Supply SSH key bytes through an appropriate direct-read personal secret at runtime; HTTPS network-secret placeholders cannot authenticate raw SSH. Never publish SSH keys, production service-role keys, Google write credentials, browser state or operator tokens in an environment image.

The environment requests the personal direct variable `AX_SAMSON_SSH_KEY_B64`. Its value is held in Personal vault, scoped only to this environment, and contains the dedicated `axdev` SSH key encoded as base64. Encoding does not encrypt the key. At task startup, decode it without logging into a temporary file owned by the runtime user with mode `0600`, set `AX_CLOUD_KEY_FILE`, and delete that file at task end. Keep the value out of installation scripts and prepared filesystem snapshots. `AX_CLOUD_TARGET=100.79.143.121` is an environment-owned, non-secret variable. The exact IPv4 is also saved under Additional allowed domains; independently check the runtime's effective TCP grant before treating SSH as available.

When editing an unpublished environment, save the configuration with **Save draft** after saving individual field dialogs. Confirm the scripts, personal requirement, destination and **VPN Configured** state before publishing. A saved dialog or auth key alone does not prove the connection. Publish or republish, then verify the updated configuration in a fresh task.

Qualification on October 6, 2026 confirmed the fresh published runtime has VPN enabled, but both TCP-grant lists are empty and `proxy:8088` refuses connections. The current environment editor and runtime tools expose no supported raw TCP-grant control. Cloud SSH and cutover therefore remain blocked until the platform supplies the exact `100.79.143.121/32` TCP grant in a replacement runtime. Additional allowed domains did not supply that grant. Preserve the narrow Tailscale port rule and leave the migration change active; an HTTP tunnel or edited snapshot is not qualification of this connection path.

`cloud-ssh.sh` validates policy and key permissions, uses SSH's supervised stdio ProxyCommand through `proxy:8088`, and enforces the pinned host key. It creates no local listener or persistent forward. Its currently expected policy snapshot has version 1, `vpn_configured: true`, and `tcp_network_access.domains` or `tcp_network_access.ip_ranges`. An unsupported snapshot requires runtime qualification, not editing the snapshot or bypassing its proxy.

The known-hosts entry uses the stable alias `accelerate-dev`; transport-address changes do not change the pinned guest identity. The Cloud draft’s installation script writes a frozen copy of the public client helpers and this out-of-band host-key pin under `/workspace/.samson-client`. Rebuild that client snapshot when helper code changes. Runtime SSH credentials remain separate from the image.

```bash
bash infra/samson-development/cloud-ssh.sh 'hostname; git -C /srv/accelerate-global/online rev-parse HEAD'
bash infra/samson-development/cloud-ssh.sh 'python3 /srv/accelerate-global/online/infra/samson-development/workspace.py worktree --task task-identifier --revision <full-commit>'
```

Cloud and Samson have separate filesystems. Explicit remote commands are required; a Cloud repository checkout does not automatically become the server checkout. Verify task hostname, path and revision before editing. Use exact recorded IPv4 grants until the selected runtime's private DNS is proved.

## Recovery and cutover

Preserve excluded `.env`, credential files, private backup directories and useful local database volumes in an age-encrypted recovery package. Keep its private recovery identity outside Samson and out of the development VM. Verify encrypted-file integrity and an isolated restore; named local Docker volumes stay intact.

Add only the new VM to the live backup roster without replacing unrelated entries. Record guest reboot and backup/restore evidence. Same-Samson backups remain single-site recovery.

Readiness has distinct stages: provisioned, transferred, locally verified, recovery verified, Cloud verified, cutover verified. An unqualified VPN identity, missing Cloud grant or absent Mac-independent test keeps cutover pending. Leave the OpenSpec change active until its required operational tasks pass. No ship or production release is part of this workflow.

Current non-secret operator selectors and sanitized execution evidence are maintained in the parent project's `docs/Infrastructure` migration receipt. Secret values never belong in this runbook.
