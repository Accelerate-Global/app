# Verification: migrate-development-to-samson

Rechecked October 8, 2026. The VM, migration, recovery method and real Cloud HTTPS workload are qualified. The existing Cloud client still reaches Samson. The corrected reusable environment remains blocked at the provider's setup/publication boundary; this change is not ready to archive.

| Dimension | Result |
| --- | --- |
| Completeness | 14/16 implementation tasks; tasks 4.3/4.4 retain the reusable-startup blocker |
| Correctness | All five requirements have implementation and qualification evidence; final startup remains unqualified |
| Coherence | Dedicated VM, encrypted recovery outside the guest, managed private HTTPS fallback and explicit partial readiness follow the design |

## Evidence

- Preservation: initial 17,822 files / 244,442,579 bytes verified, all eight app and sixteen original data refs retained, unpublished data branch preserved, source copies retained. The qualified data repository has seventeen refs including its migration branch.
- Isolation: dedicated VM137 and per-guest firewall, no hypervisor credentials in the guest, private egress denial probes, unique exact-commit worktrees, shared verification lock. Helper tests cover traversal, symlinks, task ownership, bounded regular-file reads, stale writes and exact-path staging.
- Cloud authentication: applied Cloud-to-dev TCP443 grant with the development capability; Serve is private, loopback-backed and rejects forged capability headers from an unauthorized operator. The real Cloud task used inherited proxy and verified TLS; no key, fake capability header, Mac file or forwarding was used.
- Cloud workload: `cloud-task-https-qualification-20261008-0420-06db8f64f7eb.json` on Samson records identity, exact commits, staged reversible edit, all 27 helper tests, the docs-scoped app gate, all 62 data tests and preserved canonical heads. Denials were API403/409/400 and sidecar CONNECT403 for an excluded real hostname; Cloud packet-level Tailscale denial was not measured.
- Python client: `cloud-task-https-sdk-qualification-fa2858393b474f3e.json` records the exact public client hash, real SDK identity/file/staging/job/receipt operations through the inherited proxy and normal CA trust, 27 helper tests, app gate, empty final diff and unchanged heads. Its current runtime reports enforced network policy at revision3. Shell restrictions were resolved only through the normal supported execution approval flow.
- October 8 readiness: the same Cloud task reported running/connected at revision24, enforced HTTP policy and VPN configured. Its installed-client hash and authenticated identity request passed through the inherited proxy and normal TLS using the supported execution approval flow. The app was at `533ea7e441af894e2c239bec241de1989344336c` and data at `8fce47a5a26269b93746c694636728f9018b565c`; no edits, tasks or jobs were created. The VM service was active and its canonical app checkout clean.
- Recovery: protected backups passed decompression/VMA/hash checks. The earlier full disconnected boot restore verified the complete migration checkpoint and was removed afterward. Root-only public-input control-plane archives preserve the host-side VM/firewall/provisioning configuration. Later checkpoints are integrity checks, not additional boot-restore claims.
- Repo gates: direct helper suite and strict OpenSpec validation passed. The final documentation changes require `spec:validate` through `verify:change:run`; no UI smoke or local Supabase is required.

Receipts and detailed operational evidence live under `/srv/accelerate-global/docs/Infrastructure`. Implementation is in `infra/samson-development`; the portable runbook is `docs/operations/samson-development.md`.

## Critical blockers

1. Task4.3: the old published image lacks the HTTPS client. The October 7 corrected draft `01a119cc-09c3-701b-b7c7-d143c2c140e6`, revision4, is preserved with the replacement key. A new October 8 Edit session `01a11c82-e739-712d-808e-fad628aff0fd` failed managed VPN enrollment, then reported pending/unknown network readiness and no exposed restart action. Its sole-URL requirements and exact reviewed public bootstrap saved after resolving the UI version conflict, but publication failed again. The replacement key remains listed as active; a new Edit uses the published base, so its unpublished replacement binding is not assumed. Restore the provider-managed setup/publication path before closing the task.
2. Task4.4: a new task from that corrected published version cannot be qualified until publication succeeds. The successful API and SDK workload receipts do not substitute for that final reusable-startup proof.

No requirement, design or code checks were skipped. New-image startup/publication checks remain explicitly blocked. No source deletion, production release or OpenSpec archive was performed.
