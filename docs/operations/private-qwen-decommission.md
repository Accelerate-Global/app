# Private Qwen decommission receipt

Status: completed
Started: 2026-09-19
Completed: 2026-09-21
OpenSpec archive: `2026-09-19-remove-private-qwen-data-chat`

This receipt records identifiers and outcome checks only. It must not contain
secret values, database URLs, raw prompts, generated responses, result rows,
signed tokens, or private semantic payloads.

## Retention boundary

- Delete live Qwen application, database, Storage, Vercel, Cloudflare, and
  Samson state.
- Retain Git and pull-request history, archived OpenSpec changes, already
  applied migrations, provider audit history, and existing encrypted backups
  until their ordinary retention expiry.
- Do not create a new Qwen backup, rewrite history, edit applied migrations, or
  prune existing backup snapshots for this decommission.

## Verified pre-removal inventory

### Application deployment

- Vercel team: `team_mEbZGA3ce2PVF57I6R7tPKpt`
- Vercel project: `prj_ajwIBDoruKPJPOJOLHCw6oqavGYE` (`online`)
- Baseline production deployment: `dpl_AtYKQeRWMMDC4USS7zSUYJ7YCs7o`
- Production alias: `https://data.accelerateglobal.org`
- Qwen/private-chat variable names: 13, all Production-only at baseline

### Supabase

- Linked production project ref: `uuyntfbqksnclyvlpecx`
- Audit rows: 463
- Continuation-use rows: 1
- Dataset/resource binding rows: 1
- Semantic embedding rows: 0
- Semantic resource ID: `19fa09ea-dec4-4679-9790-6754d31400cf`
- Active semantic version: `7f183abe-dfa7-4511-b821-7abca3bc4a06`
- Semantic versions: 4
- Semantic entries: 104
- Storage bucket: `reference-resource-artifacts`
- Storage prefix: `reference-resources/semantic-context-catalog/`
- Storage objects: 10 across versions `f151e5a3-d40b-4ef5-ad81-b4d118fe96aa`
  and `7f183abe-dfa7-4511-b821-7abca3bc4a06`
- Roles: `analytics_chat_login` (login) and `analytics_chat_reader` (no login)
- Active `analytics_chat_login` sessions: 0
- Views: `analytics_ro.primary_people_groups` and
  `analytics_ro.primary_people_groups_metadata`
- Vector extension: present; its only vector column is
  `private.analytics_semantic_context_embeddings.embedding`

### Cloudflare

- Personal account: `06281b845d00a5b3857bf215dec00782`
- Worker: `accelerate-qwen-edge-gateway`
- Baseline Worker version: `664b787a-7c1e-491f-98bd-f7a3e6d54e4b`
- Worker URL: `https://accelerate-qwen-edge-gateway.blake-062.workers.dev`
- Unauthenticated health response at baseline: `403`
- VPC Service: `accelerate-qwen-gateway`
  (`01a04934-2091-7de1-9f7c-6c686698cbd8`), HTTPS `8443`, `verify_full`,
  `10.77.0.30`
- Tunnel: `accelerate-qwen-samson`
  (`3587b7cf-e928-4f57-9e98-d6e74547c0b6`)
- Access service token name: `Vercel Accelerate Private Qwen`; resolve its
  current ID together with the Access application and policy IDs immediately
  before their approved deletion.
- Origin CA owner: WMTEK account `d6457eba65c9b6d71c9acd60b4b58bb7`,
  `risencode.org` zone `62b087073e97e002efa86aa93f3d8930`
- Origin certificate identity: `samson.risencode.org`, expiring
  `2028-08-28 21:57 UTC`; resolve its current certificate ID immediately before
  its approved revocation.

### Samson

- Qwen VM: 200, `accelerate-llm`, running, protected, 12 cores, 36 GiB RAM,
  100 GiB disk, `10.77.0.30/24`
- VM services: `accelerate-llm.service` and
  `accelerate-private-data-chat-gateway.service`, both enabled and active
- VM listeners: `127.0.0.1:8080` and `10.77.0.30:8443`
- Qwen state: approximately 21 GiB, including the 20.4 GB model and two
  approximately 639 MB retrieval candidates
- Tunnel LXC: 105, `accelerate-qwen-tunnel`, running, unprivileged, 1 core,
  512 MiB RAM, 8 GiB disk, `10.77.0.31/24`
- LXC service: `accelerate-qwen-tunnel.service`, enabled and active
- Scheduled Proxmox backup job excludes guests 105 and 200
- Preserved archive LXC: 104, `ax-data-archive`; never delete or alter it as
  part of this change

## Phase outcomes

- Admission disabled: passed on deployment `dpl_5fHM5M6DrpJQuBWguVQnwxup4LTH`
  (Ready, 2026-09-19 13:39 PDT); anonymous `/api/chat` returned `403`,
  `/dashboard/chat` redirected away, audit rows remained at 463, and the
  analytics login had zero active sessions
- Semantic Storage dry run: passed; the database manifests and exact Storage
  prefix matched at 10 objects, with no missing, unexpected, duplicate, or
  out-of-prefix path
- Repository candidate verified: passed; 356 test files ran 2,236 tests (three
  skipped), 557 pgTAP assertions passed, the production build passed, and the
  full UI smoke suite passed
- Semantic Storage removed: passed; exactly 10 reviewed objects were deleted
  through the Storage API and the exact prefix re-listed empty
- Supabase migration applied: passed; migration `20260919205348` removed all
  targeted roles, schema, views, functions, tables, semantic catalog rows, and
  the Qwen-only vector extension
- Retained reference resources: passed; all seven are active and healthy after
  migration, with no activation or replacement required
- Qwen-free application deployed: passed through pull request
  [#63](https://github.com/Accelerate-Global/app/pull/63), merge
  `66653abe53f0f8da1bf7f231dc10c2c82db6a9b1`; Release Health passed,
  `/dashboard/chat` returns `404`, and `POST /api/chat` resolves to the Next.js
  not-found handler
- Vercel variables removed: passed; the final name-only inventory found zero
  Qwen/private-chat variables in Production, Preview, or Development
- Cloudflare ingress removed: passed; Access application
  `05b8d75d-5119-4fcf-8abb-ba05462ed2f9`, policy
  `ae9c2d0f-0038-4f0a-bc8d-59d3378a9397`, service token
  `2eda0704-f529-4f1d-ab65-e057afac5c6e`, Worker, VPC Service, Tunnel, and the
  `samson.risencode.org` Origin CA certificate were removed; the former Worker
  URL now returns `404`
- Samson services and assets scrubbed: passed; the model, retrieval candidates,
  llama.cpp runtime/source, gateway source/configuration, evaluation material,
  credentials, systemd units, connector package, and tunnel configuration were
  removed before guest deletion, with the retired listeners verified closed
- Samson guests 105 and 200 deleted: passed after explicit confirmation on
  2026-09-21; both guest configurations and virtual disks are absent
- Final negative inventory: passed across the repository, production Supabase,
  all Vercel environments, Cloudflare, Samson, and the MikroTik worker network

## Final negative inventory

### Repository and production application

- No deployable Qwen/private-chat runtime, UI, route, edge relay, package, or
  environment contract remains. The only current-code references are negative
  assertions that prevent retired files and resource keys from returning.
- Production root remains healthy. `/dashboard/chat` returns `404`; the former
  chat API matches `/_not-found` and returns HTML rather than a chat response.
- Historical migrations, archived OpenSpec changes, Git/PR history, and this
  sanitized receipt remain under the approved retention boundary.

### Supabase and Vercel

- Production contains zero Qwen database roles, `analytics_ro` schemas, Qwen
  relations, semantic resource rows, semantic Storage objects, or `vector`
  extensions.
- All seven retained reference resources have active, valid versions.
- Production, Preview, and Development each contain zero matching
  Qwen/private-chat environment-variable names.

### Cloudflare

- The Worker and VPC Service APIs return not-found, the active Tunnel list is
  empty, the Access application/policy/token lists contain no retired object,
  and the Origin Certificates page contains no `samson.risencode.org`
  certificate.
- The former Worker hostname returns the platform's generic `404` response.

### Samson and worker network

- Proxmox contains neither LXC 105 nor VM 200, their volumes, guest firewall
  files, active monitoring records, or backup-job references.
- RouterOS contains no matching DHCP lease, ARP cache entry, host-specific
  firewall/NAT rule, address-list entry, or DNS record for `10.77.0.30`,
  `10.77.0.31`, or the retired guest MAC addresses.
- LXC 104 (`ax-data-archive`) remained running and healthy. Proxmox management,
  metrics, and router-to-Samson connectivity passed after cleanup.
- Existing external backup archives and their ordinary retention were not
  changed. Guest-local disk snapshots were removed with the explicitly
  approved guest disks.
