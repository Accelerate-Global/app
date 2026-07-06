## ADDED Requirements

### Requirement: Saved-table downloads use canonical saved-filter evaluation
Saved-table CSV downloads SHALL evaluate the saved table's persisted filters
through the same dataset filter pipeline used by the dataset detail view and
dataset default-view filtering before applying saved sorting and CSV
serialization.

#### Scenario: Owner downloads a saved table with combined filters
- **WHEN** an authenticated saved-table owner downloads a saved table with saved region, watchlist, hotspots, UUPG, country, and sorting filters
- **THEN** the CSV contains rows produced by the canonical dataset filter pipeline followed by the saved sorting
- **AND** the download still follows the existing saved-table owner and dataset-access rules

#### Scenario: Saved table uses hotspots with UUPG criteria
- **WHEN** a saved-table download ranks hotspot countries while saved UUPG criteria are configured
- **THEN** hotspot ranking uses the same UUPG criteria coupling as the dataset detail view

#### Scenario: Saved table has no active filters
- **WHEN** an authenticated saved-table owner downloads a saved table without active filter sections
- **THEN** the CSV preserves the accessible dataset rows subject only to saved sorting and visible-column serialization
