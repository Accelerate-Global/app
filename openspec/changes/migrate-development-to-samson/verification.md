# Verification: migrate-development-to-samson

Verified October 7, 2026. The VM, migration, recovery method and real Cloud HTTPS workload are qualified. The corrected reusable environment remains blocked at the provider's setup/publication boundary; this change is not ready to archive.

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
- Recovery: protected backups passed decompression/VMA/hash checks. The earlier full disconnected boot restore verified the complete migration checkpoint and was removed afterward. Root-only public-input control-plane archives preserve the host-side VM/firewall/provisioning configuration. Later checkpoints are integrity checks, not additional boot-restore claims.
- Repo gates: direct helper suite and strict OpenSpec validation passed. The final documentation changes require `spec:validate` through `verify:change:run`; no UI smoke or local Supabase is required.

Receipts and detailed operational evidence live under `/srv/accelerate-global/docs/Infrastructure`. Implementation is in `infra/samson-development`; the portable runbook is `docs/operations/samson-development.md`.

## Critical blockers

1. Task4.3: the old published image lacks the HTTPS client. The corrected saved draft has sole-URL requirements, a public hash-checked startup bootstrap and a refreshed same-scope maximum90-day VPN key, but its setup runtime stays pending without execution tools and publication fails. Latest setup chat: `01a119cc-09c3-701b-b7c7-d143c2c140e6`, draft revision4. Restore this provider-managed setup runtime and successfully publish the saved draft before closing the task.
2. Task4.4: a new task from that corrected published version cannot be qualified until publication succeeds. The successful API and SDK workload receipts do not substitute for that final reusable-startup proof.

No requirement, design or code checks were skipped. New-image startup/publication checks remain explicitly blocked. No source deletion, production release or OpenSpec archive was performed.
