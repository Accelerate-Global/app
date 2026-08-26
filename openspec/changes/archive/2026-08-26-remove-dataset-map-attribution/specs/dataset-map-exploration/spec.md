## MODIFIED Requirements

### Requirement: Map operation is provider-free and same-origin

The MVP MUST render from an application-bundled map library and a same-origin,
documented country-boundary asset. It MUST NOT require a hosted map account,
runtime API key, third-party tiles, remote map styles or fonts, external search,
or geocoding requests. The rendered Map surface MUST NOT display optional
third-party source or provider branding, while maintainers MUST retain the
boundary asset's provenance and license documentation in the repository.

#### Scenario: User opens Map mode

- **WHEN** the map renderer and boundary layer initialize
- **THEN** map code is loaded from the application bundle
- **AND** boundary data is loaded from the AX Online origin
- **AND** no third-party map request is issued
- **AND** no optional third-party source or provider branding is displayed

#### Scenario: Boundary asset provenance is inspected

- **WHEN** a maintainer reviews the bundled country-boundary asset
- **THEN** its source, release, retrieval date, transformation notes, license, and checksum are documented in the repository
