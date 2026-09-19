## ADDED Requirements

### Requirement: The product has no Private Qwen surface or runtime
The system SHALL NOT expose a Private Qwen page, navigation item, dataset handoff action, chat API, semantic-context API, session-state contract, model client, prompt/compiler/orchestrator, evaluation runtime, or deployable edge relay. Requests to the retired Qwen application routes MUST receive the application's normal not-found response and MUST NOT return an unavailable chat experience or contact an inference or analytics dependency.

#### Scenario: User looks for Qwen in the product
- **WHEN** any anonymous or authenticated user navigates the application or opens a supported dataset
- **THEN** no Qwen or data-chat affordance is rendered
- **AND** no Qwen session state is created

#### Scenario: Client requests a retired Qwen route
- **WHEN** a client requests `/dashboard/chat`, `/api/chat`, its former view-context endpoint, or the former semantic-context guiding-document endpoint
- **THEN** the application returns its normal not-found response
- **AND** no model, analytics database, semantic retrieval, or audit work occurs

### Requirement: Shared dataset and reference-resource behavior survives Qwen removal
The system SHALL preserve the existing null-preserving UUPG filter semantics through a product-neutral implementation and SHALL preserve authenticated dataset access, Country/ROG and ROP discovery, search, paging, downloads, candidate lifecycle, activation, rollback, health, and immutable resource-set behavior. No remaining non-Qwen runtime module MUST import from a Qwen or private-data-chat namespace.

#### Scenario: User applies the UUPG filter after removal
- **WHEN** the user enables either or both supported UUPG criteria on a dataset
- **THEN** eligibility and blank-value behavior match the pre-removal authoritative filter
- **AND** evaluation does not load any Qwen module

#### Scenario: User works with retained reference resources
- **WHEN** an authorized user browses, searches, downloads, or administers Country/ROG or ROP data
- **THEN** the existing role, version, lifecycle, and completeness behavior remains available
- **AND** no semantic-context catalog is required

### Requirement: Supabase contains no live Qwen data or database authority
After the teardown migration completes, Supabase SHALL contain no Qwen audit, continuation, dataset-binding, embedding, semantic-context catalog, analytics projection, analytics role, or provider-facing grant. The Qwen-only generated search state and `vector` extension MUST be absent when dependency inspection proves that no non-Qwen consumer requires them. Historical applied migrations MUST remain unchanged.

#### Scenario: Database negative inventory runs
- **WHEN** the post-migration database inventory checks schemas, roles, views, functions, triggers, tables, columns, indexes, extensions, catalog rows, grants, and Storage manifests associated with Qwen
- **THEN** every targeted Qwen object and row is absent
- **AND** no analytics chat login can connect

#### Scenario: Shared database behavior is regression-tested
- **WHEN** database security and reference-resource tests run after teardown
- **THEN** normal Auth, dataset RLS, Country/ROG, ROP, resource activation, and resource-set invariants still pass

### Requirement: Semantic-context Storage is removed without broad deletion
The decommission SHALL delete every object owned by the verified `semantic-context-catalog` resource through the authenticated Storage API before removing its database manifests. The cleanup MUST fail closed if the observed prefix, object set, resource identity, or deletion result differs from the reviewed target and MUST NOT delete objects for other reference resources.

#### Scenario: Expected semantic objects are present
- **WHEN** the cleanup resolves the reviewed semantic resource and every object belongs to its exact Storage prefix
- **THEN** it deletes those objects and verifies the prefix is empty before database teardown continues

#### Scenario: Unexpected Storage state is found
- **WHEN** an object falls outside the exact target, an expected object cannot be deleted, or the post-delete listing is non-empty
- **THEN** the teardown stops before deleting semantic manifests or unrelated Storage data

### Requirement: Vercel and Cloudflare contain no Qwen deployment dependency
After the Qwen-free application is verified, the deployment SHALL have no Qwen/private-chat environment-variable name in Production, Preview, or Development and Cloudflare SHALL have no dedicated Qwen Access token/application/policy, Worker, VPC Service, Tunnel, route, binding, Worker version, or Origin CA certificate. Secret values MUST NOT be written to the repository or decommission evidence.

#### Scenario: Deployment configuration is inventoried
- **WHEN** the operator lists environment-variable names for every Vercel environment and the relevant Cloudflare accounts/zones
- **THEN** no Qwen/private-chat name or dedicated provider resource remains
- **AND** no secret value is exposed in the receipt or logs

#### Scenario: Retired edge endpoint is requested
- **WHEN** the former Qwen Worker or origin hostname is requested after provider teardown
- **THEN** it cannot reach a Qwen service
- **AND** no Access credential or route remains capable of restoring that path

### Requirement: Dedicated Samson Qwen guests and assets are removed safely
The final decommission state SHALL contain neither Samson VM 200 (`accelerate-llm`) nor LXC 105 (`accelerate-qwen-tunnel`), and SHALL contain no Qwen service, listener, connector, credential, certificate key, model, retrieval candidate, evaluation receipt, llama.cpp runtime/source, or gateway source associated with those guests. Guest deletion MUST occur only after immediate identity/configuration verification and explicit confirmation naming both targets, and MUST NOT affect LXC 104 or shared Samson services.

#### Scenario: Guest deletion reaches its confirmation gate
- **WHEN** application, database, Vercel, and Cloudflare teardown have passed and the operator is ready to delete the guests
- **THEN** the system re-reads each target's ID, name, type, configuration, and state
- **AND** deletion waits for explicit confirmation naming guest 105 and guest 200

#### Scenario: Samson negative inventory runs
- **WHEN** guest deletion is complete
- **THEN** Proxmox, host networking, firewall, monitoring, DHCP, backup exclusions, and inventory contain no Qwen guest or service reference
- **AND** the separate data-archive guest remains healthy

### Requirement: Decommission ordering prevents use-after-removal
The decommission SHALL disable production chat admission and verify that Qwen traffic and analytics-role sessions have ceased before removing database or provider dependencies. Application and database removal MUST be verified before Vercel credentials, Cloudflare ingress, or Samson origin resources are deleted. Any failed gate MUST stop later destructive phases.

#### Scenario: Admission is still active
- **WHEN** production can still admit a chat request, new Qwen audit activity appears, or an analytics login session remains active
- **THEN** database and infrastructure teardown does not begin

#### Scenario: An intermediate verification fails
- **WHEN** a required application, database, provider, or preservation check fails
- **THEN** the operator stops at the current phase
- **AND** remediation proceeds without deleting later dependencies

### Requirement: Historical retention has an explicit boundary
The decommission SHALL delete live Qwen data and infrastructure but SHALL retain Git history, GitHub PR history, archived OpenSpec changes, already-applied migration files, provider audit history, and existing encrypted backups until their ordinary retention expiry. It MUST NOT create a new Qwen backup solely to enable rollback, rewrite history, or prune backup snapshots as part of this change.

#### Scenario: Historical repository content is scanned
- **WHEN** final verification finds Qwen names only in immutable migrations, archived changes, Git history, PR history, ordinary retained backups, or the sanitized receipt
- **THEN** the product removal can still be complete
- **AND** those retained records are not treated as live dependencies

### Requirement: Decommission evidence is sanitized and complete
The decommission SHALL produce a compact receipt with the verified resource identifiers, phase timestamps, deletion outcomes, and final negative inventories needed to demonstrate completion. The receipt MUST NOT contain credential values, database URLs, raw prompts, generated responses, result rows, signed tokens, or private semantic payloads.

#### Scenario: Reviewer inspects the decommission receipt
- **WHEN** the removal is complete
- **THEN** the reviewer can determine which repository, Supabase, Vercel, Cloudflare, and Samson targets were removed and which preservation checks passed
- **AND** the receipt reveals no secret or private chat content
