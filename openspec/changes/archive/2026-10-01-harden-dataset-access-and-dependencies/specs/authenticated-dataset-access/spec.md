## MODIFIED Requirements

### Requirement: Authenticated viewers can read workspace-visible datasets

Authenticated `pro` and `basic` users MUST be able to read workspace-visible dataset metadata, rows, downloads, and dashboard views only when any backing physical source is also workspace-visible. The supported application and API contract MUST call this classification `workspace-visible`, not `public`.

#### Scenario: Pro user opens a workspace-visible dataset page
- **WHEN** an authenticated `pro` user opens a workspace-visible dataset page with an accessible backing source
- **THEN** the dataset detail page renders for that dataset

#### Scenario: Basic user opens a workspace-visible dataset page
- **WHEN** an authenticated `basic` user opens a workspace-visible dataset page with an accessible backing source
- **THEN** the dataset detail page renders for that dataset

#### Scenario: Basic user requests workspace-visible dataset rows
- **WHEN** an authenticated `basic` user requests rows for a workspace-visible dataset with an accessible backing source
- **THEN** the API returns rows for that dataset or its resolved backing source

#### Scenario: Basic user downloads a workspace-visible dataset
- **WHEN** an authenticated `basic` user requests a workspace-visible dataset download with an accessible backing source
- **THEN** the download is allowed under the same dataset access rules as `pro`

#### Scenario: Viewer requests a visible derived view backed by restricted data
- **WHEN** an authenticated non-admin requests metadata, rows, downloads, or a saved table for a visible derived view whose physical source is restricted
- **THEN** the resource behaves as not found and no source data is returned

### Requirement: RLS mirrors application dataset read access

Supabase RLS MUST preserve the same dataset read boundary as the app layer: authenticated non-admin roles with active accounts and sessions can read workspace-visible datasets and rows only when any backing source is also workspace-visible; active admins can read workspace-visible and restricted datasets and rows. `Basic` users MUST NOT be able to insert saved dataset tables through RLS. Disabled or session-revoked users MUST NOT read or mutate app-owned data through direct Supabase Data API or Storage requests, even while an old JWT remains unexpired.

#### Scenario: Anonymous database role reads datasets
- **WHEN** the anonymous database role queries dataset metadata or rows
- **THEN** no dataset metadata or row data is visible

#### Scenario: Basic database role reads workspace-visible datasets
- **WHEN** an authenticated active `basic` database role queries workspace-visible dataset metadata or rows with an accessible backing source
- **THEN** workspace-visible dataset metadata and rows are visible

#### Scenario: Basic database role reads restricted datasets
- **WHEN** an authenticated active `basic` database role queries restricted dataset metadata or rows
- **THEN** restricted dataset metadata and rows are not visible

#### Scenario: Basic database role inserts a saved table
- **WHEN** an authenticated active `basic` database role attempts to insert a saved dataset table
- **THEN** the insert is rejected

#### Scenario: Admin database role reads restricted datasets
- **WHEN** an authenticated active admin database role queries restricted dataset metadata or rows
- **THEN** restricted dataset metadata and rows are visible

#### Scenario: Session is revoked before token expiry
- **WHEN** a former workspace user presents an unexpired JWT whose session row has been deleted
- **THEN** direct Supabase dataset, saved-table, and Storage access is denied

#### Scenario: Account is disabled before token expiry
- **WHEN** a disabled workspace user or admin presents an unexpired JWT
- **THEN** direct Supabase data reads and mutations are denied

## ADDED Requirements

### Requirement: Derived dataset visibility cannot exceed its source

A workspace-visible derived dataset MUST NOT reference a restricted physical source. Restricting a physical source MUST also restrict its derived views in the same transaction.

#### Scenario: Admin assigns restricted source to visible view
- **WHEN** an admin assigns a restricted physical source to a workspace-visible derived view
- **THEN** the assignment is rejected without changing the view or source

#### Scenario: Admin restricts a source with visible derived views
- **WHEN** an admin restricts a physical source with workspace-visible derived views
- **THEN** its derived views become restricted atomically

#### Scenario: Existing mismatched view is migrated
- **WHEN** the security migration encounters a visible derived view backed by restricted data
- **THEN** the view becomes restricted and remains available to admins
