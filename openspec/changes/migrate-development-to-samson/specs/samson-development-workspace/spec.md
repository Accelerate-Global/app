## ADDED Requirements

### Requirement: Migration preserves project material and local history
The migration SHALL preserve both repositories, all local Git refs, supporting documents and reviewed useful local state. It MUST verify transferred files and MUST retain the source copy until cutover is qualified.

#### Scenario: Unpublished data branch
- **WHEN** a local branch has no upstream and contains a commit absent from the default remote branch
- **THEN** the destination retains that exact branch and commit without publishing the private repository

#### Scenario: File mismatch
- **WHEN** a transferred file differs from the recorded source digest
- **THEN** verification fails and the source copy remains intact

### Requirement: Development has an isolated and explicit working home
The development workspace SHALL use a dedicated VM and explicit project/task paths. It MUST reject traversal, symlink escapes, existing task-path replacement and unrelated guest identities. Concurrent database verification MUST serialize use of fixed local service ports.

#### Scenario: Conflicting task path
- **WHEN** another task already owns the requested destination
- **THEN** task preparation fails without resetting or removing that task's work

#### Scenario: Private network access
- **WHEN** the guest attempts new connections to the hypervisor or another private project host
- **THEN** the isolation boundary blocks them while approved operator access and development internet access continue working

### Requirement: Cloud access is scoped and authenticated
Cloud access SHALL use the supported managed VPN transport, an authorized exact destination and a dedicated authenticated SSH identity with strict host-key verification. It MUST fail closed when the network policy, target identity or credential-file permissions are invalid.

#### Scenario: Missing network grant
- **WHEN** the selected Cloud policy has no grant for the requested private destination
- **THEN** the connection helper exits before starting forwarding or SSH

#### Scenario: Untrusted host key
- **WHEN** the server host key differs from the pinned identity
- **THEN** SSH refuses the connection without disabling verification

### Requirement: Secrets and development state remain separate
The migration SHALL preserve legacy credentials and local database recovery material in protected recovery storage outside the Cloud-accessible development guest. Ordinary development MUST use synthetic local data and MUST NOT enable legacy production publication or inherit cached Mac authentication sessions.

#### Scenario: Development environment preparation
- **WHEN** the Linux workspace is prepared
- **THEN** production administrative secrets and browser cookies are absent from its active environment and Mac-specific output paths are replaced with reviewed Linux paths

### Requirement: Readiness reflects verified boundaries
The workspace SHALL report transfer, local execution, backup/restore and Cloud qualification separately. It MUST NOT claim Mac-independent cutover while any required connection or recovery proof is missing.

#### Scenario: VPN enrollment remains pending
- **WHEN** the workspace and local tests are ready but the Cloud VPN identity is not configured
- **THEN** readiness reports Cloud access blocked and retains rollback copies

#### Scenario: Completed cutover
- **WHEN** a fresh Cloud task verifies the destination identity, reversible edit, workload checks and required recovery evidence while the Mac is unavailable
- **THEN** the workspace can be declared the working home with recorded verification evidence
