## ADDED Requirements

### Requirement: Conversational ROP access reuses the complete persisted resource
The system SHALL serve conversational ROP browsing from the same persisted typed projection, authorization policy, active-version pointer, deterministic search semantics, stable ordering, detail records, geography records, and streamed-download behavior used by `/dashboard/rop-codes`. Chat MUST NOT maintain a second mutable ROP copy or silently substitute checked-in generated data.

#### Scenario: Chat searches or pages the active ROP resource
- **WHEN** an authenticated user runs a standalone ROP resource query through chat
- **THEN** results come from the complete active persisted version under the same user access policy as the ROP resource page and label that exact version

#### Scenario: Chat opens a ROP detail result
- **WHEN** a typed lookup selects one ROP entry
- **THEN** the bounded result may include its reviewed hierarchy terms, descriptions, status, source metadata, join issue, and geography from the same version

#### Scenario: Chat offers complete export
- **WHEN** a user needs all rows matching the current ROP query
- **THEN** chat links to the same authenticated streamed CSV behavior used by the resource page and does not reconstruct or embed the complete export in a model request

#### Scenario: Active ROP resource is unavailable
- **WHEN** no healthy active persisted ROP version can serve a standalone conversational query
- **THEN** chat returns a bounded resource-unavailable state and does not substitute another ROP version or generated artifact

### Requirement: Dataset use preserves immutable ROP version binding
Standalone ROP resource queries SHALL use the labeled active ROP version, while any query combining ROP classification with a primary dataset SHALL resolve the exact immutable ROP version recorded in that dataset's producer/forming-run reference-resource set. An independently reviewed dataset version that predates publication lineage MAY use one exact private append-only legacy binding to a complete valid ROP version only while no producer publication exists. Runtime lookup MUST NOT derive that record from the active pointer. Active-version changes MUST NOT alter historical dataset query meaning.

#### Scenario: Dataset and active resource use different versions
- **WHEN** the active ROP pointer advances after a primary dataset was produced
- **THEN** standalone browsing uses the new labeled active version and dataset classification queries continue to use the older bound version

#### Scenario: Dataset lineage cannot identify one ROP version
- **WHEN** the producer/forming run has no ROP member, multiple inconsistent members, or unverifiable resource-set lineage and no eligible exact reviewed legacy binding exists
- **THEN** dataset ROP filtering/relationships fail closed while standalone active-version browsing remains independently available

#### Scenario: Reviewed pre-publication dataset uses an exact legacy binding
- **WHEN** no producer publication exists and a private immutable review record binds the exact current dataset version to one complete valid ROP version
- **THEN** dataset classification queries use that exact version, the active pointer remains irrelevant, and a later producer publication disables the legacy resolution path

### Requirement: Conversational access does not widen ROP lifecycle mutation authority
The conversational ROP adapter SHALL be read-only. Search, list, lookup, count, continuation, and authenticated export MAY be exposed to eligible chat users, but candidate building, refresh, activation, rejection, rollback, and all resource writes MUST remain on the existing admin-only, same-origin-protected lifecycle surfaces.

#### Scenario: Non-admin conversational request asks for a lifecycle mutation
- **WHEN** a user asks Qwen to refresh, activate, reject, roll back, or edit ROP data
- **THEN** no mutation endpoint is invoked and chat explains that the requested operation is outside its read-only capability

#### Scenario: Admin asks through chat for a lifecycle mutation
- **WHEN** an administrator asks the read-only chat path to perform a ROP lifecycle action
- **THEN** chat still does not mutate the resource and may direct the administrator to the existing reviewed lifecycle UI
