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

### Requirement: Authenticated viewers can read public datasets

Authenticated `pro` and `basic` users MUST be able to read public dataset
metadata, rows, downloads, and dashboard views.

#### Scenario: Pro user opens a public dataset page

- **WHEN** an authenticated `pro` user opens a public dataset page
- **THEN** the dataset detail page renders for that dataset

#### Scenario: Basic user opens a public dataset page

- **WHEN** an authenticated `basic` user opens a public dataset page
- **THEN** the dataset detail page renders for that dataset

#### Scenario: Basic user requests public dataset rows

- **WHEN** an authenticated `basic` user requests rows for a public dataset
- **THEN** the API returns rows for that dataset or its resolved backing source

#### Scenario: Basic user downloads a public dataset

- **WHEN** an authenticated `basic` user requests a public dataset download
- **THEN** the download is allowed under the same dataset access rules as `pro`

### Requirement: Authenticated viewers cannot read private datasets

Authenticated non-admin roles, including `pro` and `basic`, MUST NOT learn
whether an inaccessible private dataset exists through dataset read surfaces.

#### Scenario: Basic user opens a private dataset page

- **WHEN** an authenticated `basic` user opens a private dataset page
- **THEN** the page behaves as not found

#### Scenario: Basic user requests a private dataset API

- **WHEN** an authenticated `basic` user requests private dataset metadata, rows,
  or download data
- **THEN** the response is `404 Not Found`

### Requirement: Authenticated admins can read public and private datasets

Authenticated admins MUST be able to read public and private dataset metadata,
rows, downloads, and admin dataset surfaces.

#### Scenario: Admin opens a private dataset page

- **WHEN** an authenticated admin opens a private dataset page
- **THEN** the dataset detail page renders for that dataset

#### Scenario: Admin requests private dataset rows

- **WHEN** an authenticated admin requests rows for a private dataset
- **THEN** the API returns rows for that dataset or its resolved backing source

#### Scenario: Admin downloads a private derived dataset

- **WHEN** an authenticated admin requests a private derived dataset download
- **THEN** the API returns the derived dataset download using the same access
  rules as a private physical dataset

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

#### Scenario: Viewer requests an inaccessible private dataset

- **WHEN** an authenticated non-admin viewer requests a private dataset read
  resource
- **THEN** the page or API behaves as not found

### Requirement: Saved tables are owner-scoped and dataset-access scoped

Saved-table operations MUST require the requester to own the saved table and be
able to access the underlying dataset. Admin users may create and use saved
tables for private datasets they can access, but admin status MUST NOT grant
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

Supabase RLS MUST preserve the same dataset read boundary as the app layer:
authenticated non-admin roles can read public datasets and rows, while admins
can read public and private datasets and rows. `Basic` users MUST NOT be able
to insert saved dataset tables through RLS.

#### Scenario: Anonymous database role reads datasets

- **WHEN** the anonymous database role queries dataset metadata or rows
- **THEN** no dataset metadata or row data is visible

#### Scenario: Basic database role reads public datasets

- **WHEN** an authenticated `basic` database role queries public dataset metadata or rows
- **THEN** public dataset metadata and rows are visible

#### Scenario: Basic database role reads private datasets

- **WHEN** an authenticated `basic` database role queries private dataset metadata or rows
- **THEN** private dataset metadata and rows are not visible

#### Scenario: Basic database role inserts a saved table

- **WHEN** an authenticated `basic` database role attempts to insert a saved dataset table
- **THEN** the insert is rejected

#### Scenario: Admin database role reads private datasets

- **WHEN** an authenticated admin database role queries private dataset metadata
  or rows
- **THEN** private dataset metadata and rows are visible

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
