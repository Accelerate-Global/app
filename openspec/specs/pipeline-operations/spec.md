# pipeline-operations Specification

## Purpose
Define durable orchestration, recovery, scheduling, diagnostics, and operator controls for running the complete data pipeline safely and idempotently.
## Requirements
### Requirement: Pipeline coordination is durable and idempotent
The system SHALL coordinate code-defined named flows through durable run and stage-attempt records with exact input/rule fingerprints, transactional claims, bounded leases, progress, and idempotent effects.

#### Scenario: Duplicate continuation arrives
- **WHEN** multiple workers attempt the same runnable stage
- **THEN** only one obtains the active claim and all effects resolve to one candidate/publication identity

#### Scenario: Worker stops mid-stage
- **WHEN** a lease expires without completion
- **THEN** the stage becomes recoverable with prior attempt diagnostics retained
- **AND** retry does not reuse partial unverified artifacts as complete output

#### Scenario: Publication attempt becomes stale
- **WHEN** a product-publication lease expires before a verified commit
- **THEN** authenticated continuation records the interrupted attempt and makes the stage recoverable with a new bounded attempt
- **AND** an expired worker cannot promote partial artifacts or overwrite a newer target

### Requirement: Launch snapshots pin all current inputs once
The system SHALL resolve a normal launch in one repeatable-read snapshot and store exact source-profile bindings, secret-safe effective source request/Sheet-tab configuration checksums, source-adapter/engine and field/transformation contract versions/checksums, composite product-definition dependencies, resource set/member IDs/checksums, retained publication IDs/checksums, registry revision, Tier 1 priority payload/checksum, Tier 2 profiles/contracts, and stable-target expected-current publication IDs.

#### Scenario: A current input advances during execution
- **WHEN** a profile, resource, registry revision, publication, priority rule, or stable target changes after launch
- **THEN** every stage continues from the stored snapshot and immutable upstream outputs
- **AND** it does not substitute the newer current value

#### Scenario: A browser supplies exact inputs to a normal launch or rebuild
- **WHEN** a client submits connection, resource, publication, registry, or contract pins to the normal-launch or rebuild endpoint
- **THEN** the endpoint rejects the payload before creating a run
- **AND** only the dedicated authorized historical-backfill endpoint accepts explicit historical pins

#### Scenario: A code-defined source or product contract changes
- **WHEN** a source adapter, source engine, field contract, transformation contract, or product definition changes after a run or canary was created
- **THEN** the composite flow checksum and exact-input fingerprint change
- **AND** the older run cannot be claimed or resumed and the older canary cannot enable that changed flow

#### Scenario: An AX identity reconciliation or allocation branch changes
- **WHEN** stable-key handling, existing-binding reuse, source-pair validation/retention/collision, ROP3 generation/aliasing, no-ROP3 retention, counter allocation/reuse/exhaustion, reservation, or exact-input retry semantics change
- **THEN** the canonical immutable AX identity semantic-contract checksum and the `tier1-full` composite flow checksum change
- **AND** an older `tier1-full` run cannot be claimed or resumed under the changed identity behavior

#### Scenario: Effective source configuration changes
- **WHEN** a pinned endpoint, method, headers, body, response contract, Google spreadsheet/tab, or header selection changes after launch or canary
- **THEN** the older run fails closed before source execution
- **AND** the older canary can neither enable a schedule nor admit a due scheduled run until a new matching manual canary succeeds

#### Scenario: One invocation has enough time for multiple stages
- **WHEN** a queued run can safely advance through consecutive bounded stages
- **THEN** one continuation advances it until review, terminal state, unit limit, or invocation deadline
- **AND** an administrator can explicitly continue a still-queued run without creating a replacement run

### Requirement: Manual review gates remain authoritative
The coordinator SHALL stop at candidate/release/publication decisions and SHALL NOT automatically acknowledge warnings, activate identities, or publish datasets.

#### Scenario: Build reaches review
- **WHEN** an automated stage creates a reviewable candidate
- **THEN** the flow reports `awaiting_review` with the candidate and findings
- **AND** continues only after an authorized explicit decision

#### Scenario: Administrator rejects a review stage
- **WHEN** an authorized administrator rejects a candidate with a reason
- **THEN** the coordinator invokes the domain rejection operation before closing the stage
- **AND** domain artifacts/findings remain auditable, identity reservations are cancelled without recycling, and downstream stages cannot run

#### Scenario: Definition changed while awaiting review
- **WHEN** the deployed definition version/checksum no longer matches the reviewed run
- **THEN** resume is rejected and the administrator must rebuild with a new exact snapshot

### Requirement: Schedules are secured and opt-in
The system SHALL run schedules only for explicitly enabled schedule-eligible code-defined flows through an authenticated internal route after a manual production canary for the same definition version/checksum is recorded, with intervals no shorter than the deployed once-daily platform cadence.

#### Scenario: Unauthorized schedule request arrives
- **WHEN** a request lacks valid platform schedule authentication
- **THEN** the system rejects it without creating or advancing a run

#### Scenario: Tier 2 profile schedule is enabled
- **WHEN** an administrator enables `tier2-partner` for one active profile
- **THEN** its successful manual canary must have the same definition version/checksum and exact profile ID
- **AND** its interval, canary, enablement, and last-enqueued state remain independent from every other profile

#### Scenario: Scheduled run reaches review
- **WHEN** scheduled source work creates a forming, identity, release, or product decision
- **THEN** it stops at `awaiting_review` and does not acknowledge warnings, activate identities, finalize releases, or publish datasets

#### Scenario: Daily scheduler creates new work
- **WHEN** the authenticated daily invocation creates a due run
- **THEN** that same invocation immediately advances the new run within its bounded execution budget
- **AND** it also advances older queued runs while time remains, rather than leaving new work dormant until the next day

### Requirement: Backfills pin exact historical inputs
The system SHALL require explicit historical source/publication/resource/revision identifiers for backfills and SHALL prevent latest/current substitution after start.

#### Scenario: Historical parent is replaced during backfill
- **WHEN** a current dataset or resource changes after a backfill starts
- **THEN** the backfill continues from its originally pinned artifacts

### Requirement: Pipeline history is operational rather than analytic
The admin history SHALL show source/stages, inputs, actors, progress, timings, counts, findings, retries, failures, publications, and out-of-date state without collecting unrelated product usage analytics.

#### Scenario: Administrator diagnoses failure
- **WHEN** a stage fails or becomes stale
- **THEN** history identifies the affected flow/stage, safe normalized reason, exact inputs, attempt history, and allowed recovery action

### Requirement: Legacy cutover is per-flow and non-dual-write
The system SHALL keep retained legacy inputs, ledgers, outputs, and comparison evidence read-only and SHALL NOT treat a legacy writer as retired until the matching online flow/profile has passed production canary, parity approval, live-target verification, and rollback rehearsal.

#### Scenario: Configured flow becomes authoritative
- **WHEN** the exact online flow passes its cutover checks
- **THEN** the matching legacy writer is frozen immediately before authoritative online publication and then disabled
- **AND** legacy evidence remains read-only for audit

#### Scenario: Profile is not configured or has no matching canary
- **WHEN** a supported source/profile has not passed the cutover checks
- **THEN** its legacy writer remains unchanged and no online/legacy dual write begins
