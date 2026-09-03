## ADDED Requirements

### Requirement: Reviewed filter regions compile through deterministic country scope
The system SHALL resolve exact filter-region names and reviewed compatibility aliases from the authoritative region registry, SHALL require that registry checksum to match the active semantic snapshot, and SHALL apply the resulting country set before parameterized SQL compilation. Qwen MUST NOT supply, alter, or infer region membership.

#### Scenario: South Asia resolves successfully
- **WHEN** `South Asia` resolves to `Asia, South` and the registry checksum matches the active semantic snapshot
- **THEN** deterministic application code applies exactly the registered countries as a bounded country predicate before compilation

#### Scenario: Global region is requested
- **WHEN** the exact reviewed `Global` region is requested
- **THEN** execution applies no country predicate and retains all otherwise authorized dataset rows

#### Scenario: Region definitions drift
- **WHEN** the live registry checksum differs from the active semantic snapshot or its country membership is empty or over the approved bound
- **THEN** no region-scoped query executes and the user receives a bounded refresh or clarification state

#### Scenario: Model proposes conflicting geography
- **WHEN** Qwen emits a country predicate that conflicts with the server-resolved region scope
- **THEN** the model predicate cannot alter the trusted region and only the exact registry-owned scope reaches compilation

#### Scenario: Region-like value contains adversarial text
- **WHEN** a value resembles SQL, prompt instructions, an unreviewed alias, or a partial region name
- **THEN** it does not resolve as a reviewed region and cannot create executable identifiers or widen query authority
