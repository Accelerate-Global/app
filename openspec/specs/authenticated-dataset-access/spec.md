# authenticated-dataset-access Specification

## Purpose
Define the durable access contract for authenticated dataset pages, dataset APIs,
row APIs, downloads, saved tables, and dashboard flows.
## Requirements
### Requirement: Anonymous dataset access is denied

Anonymous users MUST NOT access authenticated dataset dashboard pages, dataset
JSON APIs, row APIs, downloads, or saved-table APIs.

#### Scenario: Anonymous user requests a dataset page

- **WHEN** an unauthenticated request opens a dataset dashboard page
- **THEN** the user is redirected to the app's route-relative sign-in entry page

#### Scenario: Anonymous user requests the deployed app

- **WHEN** an unauthenticated browser request opens a protected dataset page on
  `data.accelerateglobal.org`
- **THEN** the user is forwarded to that host's sign-in entry page

#### Scenario: Anonymous user requests a dataset API

- **WHEN** an unauthenticated request calls a dataset or saved-table JSON API
- **THEN** the response is `401 Unauthorized`

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

### Requirement: Dataset mutations are admin-only

Dataset mutation operations MUST require an authenticated admin.

#### Scenario: Pro user attempts a dataset mutation

- **WHEN** an authenticated `pro` user attempts to create, update, delete,
  reorder, replace, batch-write rows, assign derived views, or revert dataset versions
- **THEN** the response is `403 Forbidden`

#### Scenario: Basic user attempts a dataset mutation

- **WHEN** an authenticated `basic` user attempts to create, update, delete,
  reorder, replace, batch-write rows, assign derived views, or revert dataset versions
- **THEN** the response is `403 Forbidden`

#### Scenario: Anonymous user attempts a dataset mutation

- **WHEN** an unauthenticated request attempts a dataset mutation
- **THEN** the response is `401 Unauthorized`

### Requirement: Missing and unauthorized read resources are not distinguishable

Dataset read surfaces MUST NOT expose different read outcomes for missing
datasets and datasets inaccessible to the current authenticated principal.

#### Scenario: Viewer requests a missing dataset

- **WHEN** an authenticated non-admin viewer requests a missing dataset read
  resource
- **THEN** the page or API behaves as not found

#### Scenario: Viewer requests an inaccessible restricted dataset

- **WHEN** an authenticated non-admin viewer requests a restricted dataset read
  resource
- **THEN** the page or API behaves as not found

### Requirement: Saved tables are owner-scoped and dataset-access scoped

Saved-table operations MUST require the requester to own the saved table and be
able to access the underlying dataset. Admin users may create and use saved
tables for restricted datasets they can access, but admin status MUST NOT grant
access to another user's saved table. `Basic` users MUST NOT create new saved
tables, but they MAY read, update, delete, open, and download their own existing
saved tables when the underlying dataset is accessible.

#### Scenario: Pro owner creates a saved table for an accessible dataset

- **WHEN** an authenticated `pro` user creates a saved table for a dataset they can access
- **THEN** the saved table is created

#### Scenario: Basic owner attempts to create a saved table

- **WHEN** an authenticated `basic` user creates a saved table for an accessible dataset
- **THEN** the response is `403 Forbidden`

#### Scenario: Basic owner opens an existing saved table for an accessible dataset

- **WHEN** an authenticated `basic` user opens, reads, updates, deletes, or
  downloads their own saved table whose underlying dataset is accessible to them
- **THEN** the operation is allowed subject to payload validation

#### Scenario: Non-owner requests a saved table

- **WHEN** an authenticated user requests another user's saved table
- **THEN** the response is `404 Not Found`

#### Scenario: Owner requests a saved table for an inaccessible dataset

- **WHEN** an authenticated user requests their own saved table after the
  underlying dataset becomes inaccessible to them
- **THEN** the response is `404 Not Found`

#### Scenario: Admin owner requests a private-dataset saved table

- **WHEN** an authenticated admin requests their own saved table whose underlying
  dataset is private
- **THEN** the operation is allowed subject to payload validation

#### Scenario: Admin requests another user's private-dataset saved table

- **WHEN** an authenticated admin requests a saved table owned by another user
- **THEN** the response is `404 Not Found`

#### Scenario: Owner creates a saved table for an inaccessible dataset

- **WHEN** an authenticated user creates a saved table for a dataset they cannot
  access
- **THEN** the response is `404 Not Found`

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

### Requirement: Dataset CSV downloads neutralize spreadsheet formulas
Dataset and saved-table CSV downloads SHALL serialize accessible row data in a
way that prevents spreadsheet software from interpreting formula-leading cell
values as executable formulas.

#### Scenario: User downloads dataset rows with formula-leading values
- **WHEN** an authenticated user downloads a dataset containing a cell whose
  first non-space character is `=`, `+`, `-`, `@`, tab, carriage return, or
  newline
- **THEN** the CSV cell is emitted as text by prefixing an apostrophe before
  the dangerous value
- **AND** the download still follows the existing dataset access rules

#### Scenario: User downloads normal dataset rows
- **WHEN** an authenticated user downloads dataset or saved-table rows without
  formula-leading values
- **THEN** the CSV preserves existing delimiter, quote, and line-ending behavior

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

### Requirement: Restricted dataset metadata carries a synchronized Private tag

The system MUST store exactly one canonical red `Private` tag on dataset metadata when the dataset is hidden from non-admin users and MUST store no `Private` tag when the dataset is workspace-visible. Workspace visibility MUST remain the authorization source of truth.

#### Scenario: Admin hides a workspace-visible dataset

- **WHEN** an authenticated admin disables workspace visibility for a dataset
- **THEN** the dataset becomes inaccessible to non-admin users under the existing access rules
- **AND** its metadata contains exactly one canonical red `Private` tag

#### Scenario: Admin makes a restricted dataset workspace-visible

- **WHEN** an authenticated admin enables workspace visibility for a restricted dataset
- **THEN** the dataset becomes accessible to authenticated non-admin workspace users under the existing access rules
- **AND** its metadata contains no `Private` tag

#### Scenario: A writer submits inconsistent visibility and tag metadata

- **WHEN** an application or database writer stores dataset metadata whose `Private` tags disagree with workspace visibility
- **THEN** the persisted tags are canonicalized to match workspace visibility
- **AND** duplicate, differently colored, or case-variant `Private` tags do not remain

#### Scenario: Existing restricted datasets are migrated

- **WHEN** the visibility-linked tag behavior is deployed
- **THEN** every existing dataset hidden from non-admin users receives the canonical red `Private` tag
- **AND** existing classification and user-managed tags are preserved

#### Scenario: Non-admin requests a restricted dataset

- **WHEN** an authenticated non-admin user requests a restricted dataset after the tag is added
- **THEN** the existing not-found access response is preserved
- **AND** the `Private` tag does not disclose the dataset to that user

### Requirement: New-dataset onboarding explicitly reviews initial access
The system SHALL show administrators the initial workspace access of every new Google Sheets or CSV dataset before creation while preserving workspace visibility as the authorization source of truth and the current workspace-visible compatibility default.

#### Scenario: Administrator keeps workspace-visible access
- **WHEN** an administrator confirms onboarding with Everyone in the workspace selected
- **THEN** each created dataset is workspace-visible under existing application and RLS access rules
- **AND** its metadata does not contain the system-managed `Private` tag

#### Scenario: Administrator chooses administrators-only access
- **WHEN** an administrator confirms onboarding with Only administrators selected
- **THEN** each created dataset is hidden from non-admin users under existing application and RLS access rules
- **AND** its metadata contains exactly one canonical red `Private` tag

#### Scenario: Legacy creation caller omits access
- **WHEN** an existing authorized creation caller omits initial workspace visibility
- **THEN** the system preserves the existing workspace-visible default

#### Scenario: Non-admin attempts onboarding mutation
- **WHEN** an unauthenticated, `pro`, or `basic` caller attempts to create a dataset or connection through onboarding APIs
- **THEN** the existing `401 Unauthorized` or `403 Forbidden` mutation behavior is preserved
