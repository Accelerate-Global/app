## ADDED Requirements

### Requirement: PGAC Aggregate 1 uses exact specific-PG input
The system SHALL group one exact specific-PG publication by nonblank ROP3, sum valid population, compute approved weighted percentages, select deterministic country/provenance values, and retain exact parent/rule lineage.

#### Scenario: Percentage inputs include blanks
- **WHEN** some constituent rows omit a Christian percentage
- **THEN** their population remains in the total denominator and contributes zero numerator
- **AND** output truncates deterministically to two decimal places

#### Scenario: Primary-country population ties
- **WHEN** multiple countries share highest population
- **THEN** the stable parent row order determines the primary and alternatives remain sorted/deduplicated

### Requirement: Named Aggregate 1 products bind exact parents
Self-Engaged, Watchlist, Baseline UUPG, Hotspots, and South Asia SHALL each execute as a named versioned definition from one exact parent publication and SHALL retain deterministic findings/artifacts/checksum.

Each definition checksum SHALL include its canonical executable semantic
contract, including thresholds, scope versions, normalization/ranking rules,
and external binding keys. A change to any such rule SHALL change the product
checksum and the checksum of every composite flow that contains the product.

#### Scenario: Parent advances
- **WHEN** a newer parent publishes
- **THEN** the existing child is marked out of date but remains unchanged until explicit rebuild and publish

#### Scenario: Hotspots is built
- **WHEN** Baseline contains qualifying country rows
- **THEN** Hotspots sums valid population by canonical primary country and returns exactly the top ten ordered by total descending then name ascending
