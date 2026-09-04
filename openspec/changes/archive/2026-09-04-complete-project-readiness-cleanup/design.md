## Context

`origin/main` is the canonical public source and Vercel deployment input. A
forensic audit found three forms of drift that weaken that contract:

- Cloudflare Worker version 2 was uploaded immediately after a local hostname
  change to `samson.risencode.org`, and the bound VPC Service was then moved to
  `verify_full`, but `origin/main` still requests
  `accelerate-qwen-gateway.internal`.
- CI uploads Playwright HTML output and failure diagnostics. A preserved May
  remediation found authenticated local Supabase cookies in those traces, but
  its safe reporter and workflow policy were never merged.
- The protected dependency gate intentionally blocks only high/critical
  findings, while currently compatible lower-severity patches remain unapplied.

The primary checkout also accumulated already-merged content, old worktrees,
and stashes. Unique provider evidence has been committed and pushed to a
temporary rescue branch before cleanup begins.

## Goals / Non-Goals

**Goals:**

- Make the checked-in Worker hostname, tests, documentation, and OpenSpec
  history reproduce the TLS identity already enforced by Cloudflare.
- Ensure CI never records or uploads authenticated Playwright diagnostics and
  retains only a bounded, content-sanitized result summary.
- Establish durable public-repository security controls and reporting paths.
- Clear every compatible dependency advisory and prove the exact lockfile
  through the full repository gate.
- Finish with one clean, current primary checkout and no obsolete local or
  remote development state.

**Non-Goals:**

- Change Supabase schema, RLS, Auth, Storage, production data, or admin roles.
- Change Qwen prompts, model runtime, Access credentials, HMAC semantics,
  canary membership, or the VPC route/IP/port.
- Expand Plan 002 into a production data-pipeline cutover.
- Provision an off-site Restic destination without an owner-selected provider.
- Replace local Playwright diagnostics; only CI capture is restricted.

## Decisions

### Preserve and port, rather than merge the stale worktree

The ten-file TLS state is preserved in a dedicated rescue commit. Only its
semantic changes are applied to current `origin/main`; older Samson, Qwen, and
documentation snapshots are not restored. This avoids regressing the hardening
and semantic-RAG work merged after the local deployment.

Alternative considered: merge or cherry-pick the entire stale tree. Rejected
because most of its 154 paths are old or already merged, and several unique
Samson variants remove later security hardening.

### Treat the fetch hostname as cryptographic identity, not routing

The Worker requests `https://samson.risencode.org`. The VPC Service remains the
only route to `10.77.0.30:8443`; Cloudflare documentation confirms the URL host
sets HTTP `Host` and TLS SNI while the service configuration fixes the network
target. `verify_full` therefore validates the Origin CA chain and this exact
hostname without adding public DNS or a public Samson route.

### Emit a deliberately lossy CI result artifact

CI disables traces, screenshots, and videos and replaces the HTML reporter with
a custom JSON reporter. The reporter records only suite/test titles, aggregate
counts, status, retries, attachment count, and error count. It excludes error
messages, stacks, stdout/stderr, attachment names/paths/bodies, browser state,
and page content. The workflow uploads only that file for seven days.

Local smoke retains current diagnostics because local files are not published.
Repository workflow policy rejects future UI-smoke uploads that reference raw
Playwright directories, trace archives, screenshots, videos, or multi-path
artifact definitions.

Alternative considered: Playwright's built-in JSON reporter. Rejected because
its error and attachment detail is intentionally useful for debugging and is
therefore broader than the safe publication contract.

### Patch only vulnerable dependency ranges

Pnpm overrides target the vulnerable ranges for `esbuild`, `postcss`, `undici`,
`hono`, and `qs`. Newer versions already selected for other parents remain
untouched. This avoids the abandoned broad `esbuild` override that downgraded a
newer Vite-compatible copy and desynchronized the lockfile.

### Make imported labels structurally plain instead of regex-sanitized

The first CodeQL default-setup scan identified five high-severity sanitizer
findings in Etnopedia and country-code parsing. These inputs are external even
though React normally escapes their eventual display. Plain-text parsing now
decodes one entity layer before markup removal, walks markup boundaries without
relying on a one-pass multi-character replacement, and decodes ampersands last
so encoded entities cannot be unintentionally decoded twice. Same-stem tests
cover encoded tags, overlapping delimiters, and nested entity text.

### Separate repository controls from merge-time code

Tracked files define CI behavior and security reporting. During the cleanup,
GitHub settings enable secret scanning, push protection, private vulnerability
reporting, CodeQL, SHA pinning, stricter branch protection, short global artifact
retention, and merged-branch deletion. The old private repository is archived
rather than deleted so historical evidence remains recoverable.

### Keep strategic work explicit rather than pretending it is cleanup

Plan 002 remains an intentional P1 delivery program, the Qwen feature remains
an intentional bounded canary, and the archive remains explicitly single-site.
Documentation distinguishes those product/owner decisions from hidden Git or
release debt. First-admin and API-connection governance receive actionable
runbooks so they no longer remain undefined questions.

## Risks / Trade-offs

- **[Incorrect TLS source reconstruction]** → Compare the rescue commit,
  deployed version timing, live `verify_full` state, Worker tests, and an
  Access-denied health request before and after release.
- **[CI failures are harder to debug]** → Preserve full trace/screenshot/video
  diagnostics locally and publish bounded counts that identify the failing test
  without publishing captured content.
- **[Dependency override incompatibility]** → Run direct tooling tests,
  `pnpm audit`, the complete app lane, UI smoke, and the terminal gate with the
  exact lockfile.
- **[Sanitizer compatibility]** Removing markup structurally can change spacing
  around source tags → Collapse whitespace after parsing and protect existing
  source fixtures plus adversarial boundary cases in the direct parser suites.
- **[Security setting blocks the cleanup PR]** → Preserve the exact five
  established required checks and zero mandatory human approvals for the current
  single-maintainer workflow while extending their enforcement to administrators.
- **[Artifact deletion removes debugging evidence]** → Delete only published
  `ui-smoke-report` artifacts after the replacement reporter and workflow policy
  pass locally; local diagnostics and GitHub job logs remain available.
- **[Historical repository loss]** → Archive rather than delete it, then remove
  only the local `old-origin` remote.

## Migration Plan

1. Preserve and push the uncommitted TLS state on a temporary rescue branch.
2. Port the TLS identity and archived change evidence to a clean branch from
   current `origin/main`.
3. Implement safe CI reporting, workflow enforcement, public security files,
   dependency patches, external-source sanitizer fixes, and current-state
   documentation.
4. Enable and verify GitHub security/settings controls and CodeQL; delete legacy
   smoke artifacts, close superseded bot PRs, and archive the historical repository.
5. Run focused tests, `pnpm run verify:change:run`, OpenSpec verification,
   archive this change, and run `pnpm run verify:ship:local`.
6. Open and ship the PR through the repository release command; verify Vercel,
   the public alias, CodeQL, Cloudflare Access denial, VPC `verify_full`, and
   Supabase migration parity.
7. Redeploy the Worker from canonical `main`, then remove merged branches, stale
   worktrees, redundant stashes, temporary rescue refs, and `old-origin`; finish
   on a clean, current local `main`.

Rollback: revert the cleanup PR for tracked behavior. If the Worker source were
ever redeployed and failed, redeploy the preserved rescue version while keeping
the VPC route and Access/HMAC boundaries unchanged. GitHub artifacts cannot be
restored after deletion, which is intentional because they contain unsafe
diagnostics; job logs remain the retained evidence.

## Open Questions

None. Provider selection for a future off-site archive and authorization for a
future pipeline cutover remain explicitly outside this cleanup.
