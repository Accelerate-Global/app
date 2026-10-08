# Samson development workspace

The dedicated `accelerate-dev` Linux guest holds Accelerate Global's app, private data repository and supporting files under `/srv/accelerate-global`. A fresh Cloud task has passed authenticated HTTPS, isolated edits/reverts and fixed workload checks without Mac files or forwarding. The reusable environment's corrected startup is still blocked by its setup runtime and failed publication; preserve the Mac rollback copy and keep OpenSpec active until that final startup proof passes. Migration does not enable production publication or change hosted Vercel/Supabase behavior.

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

### Private HTTPS development API

The private HTTPS API at `https://accelerate-dev.tail13a215.ts.net` is implemented by `job_api.py` and the `accelerate-job-api.service` unit. It runs as `axdev`, listens only on `127.0.0.1:8765`, and uses Tailscale Serve for TLS and the stamped `accelerate.local/cap/develop` capability with role `develop`. Every operation requires that capability. The applied grant permits Cloud TCP443 only to this VM with the capability and denies Cloud SSH. Operator SSH remains separate. No Funnel or generic TCP/shell bridge is configured.

The fix plan and remaining reusable-startup gate are in `openspec/changes/migrate-development-to-samson/cloud-fix-plan.md`. Cloud task `01a119bc-499b-75e3-a38b-d9c9aaa95010` passed real managed-proxy identity, a staged runbook edit/revert, all 27 helper tests, the docs-scoped app terminal gate and all 62 data tests. Credential-path access was rejected with HTTP 403, a stale edit with 409, and an unknown check with 400. The excluded remote-access hostname received proxy CONNECT 403; this is destination-policy evidence, not a claim of Cloud Tailscale packet testing. Canonical heads and persistent data were preserved.

Publication captures prepared files; editing an install-script field does not execute it. The last working published image still has historical public SSH helpers and lacks `cloud-api.py`. The corrected draft removes the legacy SSH requirement, keeps only `AX_CLOUD_API_URL`, and embeds the reviewed public installer and client SHA256 in its startup skill so every task prepares the client before authenticated remote work. On October 8, a fresh supported Edit session (`01a11c82-e739-712d-808e-fad628aff0fd`) failed during managed VPN enrollment, then reported pending with unknown network readiness and no exposed restart action. The exact reviewed bootstrap survived the save/version-conflict reload and the UI confirmed all changes saved, but publication again failed. The earlier corrected draft `01a119cc-09c3-701b-b7c7-d143c2c140e6` remains preserved. A fresh Edit starts from the published base; do not assume that an unpublished draft's VPN-key replacement carries into another Edit session. Do not report automatic reusable startup as qualified; no platform-policy bypass is authorized.

The existing qualified Cloud task was rechecked on October 8. Its runtime was running/connected at revision 24 with enforced HTTP policy and VPN configured. The installed public client matched SHA256 `66969905879e631b3f88c5d9f6fad8fdc63cbe39a1a7143f02b261d0047bc4ab`; its authenticated identity request reached the correct VM/root and current canonical commits through the inherited proxy and verified TLS. Only the supported shell approval flow was needed. This read-only recheck made no task, file or job changes and does not qualify the unpublished correction. Dated evidence is in `docs/Infrastructure/samson-cloud-recheck-2026-10-08.json` in the parent workspace and on Samson.

The existing Cloud key has the original maximum 90-day expiry of January 4, 2027. A same-scope reusable/ephemeral replacement was saved in the October 7 corrected draft with the maximum 90-day expiry of January 5, 2027, public key ID `k7k8khNrJm11CNTRL`. That key was still listed as active on October 8; its publication and fresh startup remain unqualified. No additional key was generated during the recheck. The VM's persistent tagged node still has expiry disabled. Key values belong only in managed VPN settings; the unused Personal vault SSH recovery entry was preserved without reading its value.

The public `cloud-api.py` client needs Python's standard library and the inherited HTTPS proxy. It verifies the exact private HTTPS origin, the supported VPN policy and the default CA trust, forces the proxy even when `NO_PROXY` is present, and rejects redirects. It uses no SSH private key or application bearer secret.

```bash
python3 /workspace/.samson-client/cloud-api.py GET /v1/identity
python3 /workspace/.samson-client/cloud-api.py POST /v1/tasks --body-file task.json
python3 /workspace/.samson-client/cloud-api.py POST /v1/tasks/task-id/checks --body-file check.json
python3 /workspace/.samson-client/cloud-api.py GET /v1/jobs/job-id
```

Task creation accepts `task`, `repository` (`online` or `data`) and an exact 40-character commit. Tasks are detached worktrees, never a reset of the canonical checkout. App tasks share the current dependency cache until `app:install` creates private task dependencies, and receive synthetic localhost configuration. File operations reject credential/cache/control paths and symlink traversal. Reads return bounded base64 chunks plus SHA256; edits require the expected SHA256, with `null` allowing only a new file. Supporting `docs`, `meeting` and `exports` roots are read-only. Receipts use create-only `cloud-task-*.md` or `.json` names under `docs/Infrastructure`.

File edits preserve the executable flag by default; an optional boolean `executable` changes only that flag. Before the terminal gate, stage reviewed exact paths with `POST /v1/tasks/ID/stage` and `{"paths":["relative/file"]}`. Staging uses literal Git paths, accepts individual regular files or tracked deletions, and rejects directories, credentials and symlinks. This ensures new source/tests participate in the repo's tracked-tree fingerprint and verification cache.

Registered checks are `helpers:test`, `app:plan`, `app:typecheck`, `app:fast`, `app:verify`, `app:install` and `data:unit`. Job state and bounded logs persist under `.cloud-jobs`; only one verification job runs at a time and holds `.verification.lock`. `app:verify` performs the repo terminal gate and prepares/stops synthetic local Supabase only when the plan requires it. Jobs have a two-hour limit and a 32-MiB output limit. Interrupted jobs are marked interrupted on service restart rather than reported as passed. There is no arbitrary-command, environment-override, Git-push or production-publication endpoint.

This interface grants development authority within the project VM. Executing edited repository code and Docker access retain the previously documented guest-level privilege; the API is not a sandbox for hostile project code. Production/recovery credentials and hypervisor access remain outside this guest.

### Earlier SSH transport qualification

Create a private Cloud environment for the intended repositories. Add the dedicated Tailscale VPN connection in Advanced settings and allow only its required destinations. Cloud's enrollment key is reusable and ephemeral; the guest's persistent node uses its own identity. Review the effective tailnet policy: broad existing grants can defeat a narrow new grant. Restrict the Cloud source tag to this guest's TCP22 and preserve operator access separately. Do not advertise subnet routes, create an exit node or expose the Codex app server publicly.

The earlier SSH configuration used the private environment **Accelerate Global Samson**, VM 137 at `accelerate-dev.tail13a215.ts.net`, IPv4 `100.79.143.121`, and the same persistent guest and ephemeral Cloud tags. Its former TCP22 grant has been replaced by the HTTPS capability above. The following SSH selectors and October 6 results are historical troubleshooting/recovery information, not the current Cloud access recipe.

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
