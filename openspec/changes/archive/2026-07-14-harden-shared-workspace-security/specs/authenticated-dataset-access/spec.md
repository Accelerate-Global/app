## MODIFIED Requirements

### Requirement: Authenticated viewers can read workspace-visible datasets

Authenticated `pro` and `basic` users MUST be able to read workspace-visible dataset metadata, rows, downloads, and dashboard views. The supported application and API contract MUST call this classification `workspace-visible`, not `public`.

#### Scenario: Pro user opens a workspace-visible dataset page

- **WHEN** an authenticated `pro` user opens a workspace-visible dataset page
- **THEN** the dataset detail page renders for that dataset

#### Scenario: Basic user opens a workspace-visible dataset page

- **WHEN** an authenticated `basic` user opens a workspace-visible dataset page
- **THEN** the dataset detail page renders for that dataset

#### Scenario: Basic user requests workspace-visible dataset rows

- **WHEN** an authenticated `basic` user requests rows for a workspace-visible dataset
- **THEN** the API returns rows for that dataset or its resolved backing source

#### Scenario: Basic user downloads a workspace-visible dataset

- **WHEN** an authenticated `basic` user requests a workspace-visible dataset download
- **THEN** the download is allowed under the same dataset access rules as `pro`

### Requirement: Authenticated viewers cannot read restricted datasets

Authenticated non-admin roles, including `pro` and `basic`, MUST NOT learn whether an inaccessible restricted dataset exists through dataset read surfaces.

#### Scenario: Basic user opens a restricted dataset page

- **WHEN** an authenticated `basic` user opens a restricted dataset page
- **THEN** the page behaves as not found

#### Scenario: Basic user requests a restricted dataset API

- **WHEN** an authenticated `basic` user requests restricted dataset metadata, rows, or download data
- **THEN** the response is `404 Not Found`

### Requirement: Authenticated admins can read workspace-visible and restricted datasets

Authenticated admins MUST be able to read workspace-visible and restricted dataset metadata, rows, downloads, and admin dataset surfaces.

#### Scenario: Admin opens a restricted dataset page

- **WHEN** an authenticated admin opens a restricted dataset page
- **THEN** the dataset detail page renders for that dataset

#### Scenario: Admin requests restricted dataset rows

- **WHEN** an authenticated admin requests rows for a restricted dataset
- **THEN** the API returns rows for that dataset or its resolved backing source

#### Scenario: Admin downloads a restricted derived dataset

- **WHEN** an authenticated admin requests a restricted derived dataset download
- **THEN** the API returns the derived dataset download using the same access rules as a restricted physical dataset

### Requirement: RLS mirrors application dataset read access

Supabase RLS MUST preserve the same dataset read boundary as the app layer: authenticated non-admin roles can read workspace-visible datasets and rows, while admins can read workspace-visible and restricted datasets and rows. `Basic` users MUST NOT be able to insert saved dataset tables through RLS.

#### Scenario: Anonymous database role reads datasets

- **WHEN** the anonymous database role queries dataset metadata or rows
- **THEN** no dataset metadata or row data is visible

#### Scenario: Basic database role reads workspace-visible datasets

- **WHEN** an authenticated `basic` database role queries workspace-visible dataset metadata or rows
- **THEN** workspace-visible dataset metadata and rows are visible

#### Scenario: Basic database role reads restricted datasets

- **WHEN** an authenticated `basic` database role queries restricted dataset metadata or rows
- **THEN** restricted dataset metadata and rows are not visible

#### Scenario: Basic database role inserts a saved table

- **WHEN** an authenticated `basic` database role attempts to insert a saved dataset table
- **THEN** the insert is rejected

#### Scenario: Admin database role reads restricted datasets

- **WHEN** an authenticated admin database role queries restricted dataset metadata or rows
- **THEN** restricted dataset metadata and rows are visible

## RENAMED Requirements

- FROM: `Authenticated viewers can read public datasets`
- TO: `Authenticated viewers can read workspace-visible datasets`
- FROM: `Authenticated viewers cannot read private datasets`
- TO: `Authenticated viewers cannot read restricted datasets`
- FROM: `Authenticated admins can read public and private datasets`
- TO: `Authenticated admins can read workspace-visible and restricted datasets`
