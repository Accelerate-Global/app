# Google Sheets and Partner Exports

Partner exports let an administrator connect one Google Sheet tab as a dataset,
review an explicit column crosswalk, and generate a private CSV for Joshua
Project or another organization. The source dataset is never modified by
profile edits, previews, or export runs.

## Add a dataset

Accelerate currently uses an app-owned Google service account rather than a
user OAuth connection.

Administrators start from **Add dataset** on the dashboard and choose one of
two guided sources:

- **Google Sheet** keeps the source in Google and creates one refreshable data
  source and dataset for every selected tab.
- **CSV file** reviews the local file's first row before upload. The file is not
  sent to Accelerate until the administrator confirms the final review.

For Google Sheets:

1. Share the private Sheet with the app email shown in **Add dataset** as a
   **Viewer**. Sharing controls whether Accelerate can read the source; it does
   not control who can see the imported dataset.
2. Paste the Sheet URL, confirm access, and select one or more tabs. Accelerate
   inspects only the first 25 rows of each selected tab and recommends the most
   likely header row.
3. A high-confidence recommendation stays compact but can still be reviewed.
   Ambiguous structures open the header review automatically. Choose a
   different row or combine up to three consecutive header rows when needed.
4. Review the dataset name for each tab, choose PGAC or PGIC, and explicitly
   choose **Everyone in the workspace** or **Only administrators**.
5. Confirm once. Accelerate connects each selected tab, runs its first import,
   and shows progress and an **Open dataset** link for every successful result.
   A failed tab can retry its import without reconnecting the Sheet.

Choosing **Only administrators** adds the synchronized **Private** system tag
to the imported dataset and hides it from non-admin users. It does not alter
the Google Sheet's sharing settings. The same access choice is available for
CSV imports.

Report titles, partner instructions, and numeric guide rows are scored as
unlikely headers. A clean, high-confidence Sheet can use the recommendation as
shown. Low-confidence structures require administrator review instead of being
silently imported.

Some Sheets use genuine grouped headers across two or three consecutive rows.
Use **Header rows to combine** to compose those rows from top to bottom. Blank,
repeated, and numeric-guide fragments are removed, and merged group labels are
expanded when Google supplies merge metadata. Leave this set to **One row**
when the row above the real column titles is only a report title or user
reference.

The selected row numbers are the same one-based numbers shown in Google Sheets.
All rows through the selected header are excluded from the dataset, so titles
and guidance no longer inflate the imported row count.

Each selected tab becomes its own connection and source dataset. Accelerate
identifies a tab by its stable Google `sheetId`, so renaming a tab is safe: the
next access check or refresh updates its display title. Deleting a selected tab
causes access checks and refreshes to fail visibly rather than reading a
different tab.

An administrator can use **Review headers** on an existing Google Sheets
connection to preview and save a corrected row or combined range before the
next refresh. Accelerate fingerprints the confirmed labels. If unchanged
headers move because rows were inserted above them, the import safely relocates
the exact match. If the labels change or become ambiguous, refresh stops before
replacing the current dataset and asks for another header review.

After a successful first import, **Open dataset** leads to the dataset detail
page, where an administrator can create the partner export profile. Existing
integrations, refresh actions, run status, and diagnostics remain under
**Data sources**. Failed access, parsing, size, or header-drift checks preserve
the current dataset and its downloadable versions.

An active tab cannot be connected twice. A submission containing both an
already-connected tab and a new tab is rejected as a whole. Disconnecting
archives the connection and keeps its run history, dataset association, and
downloads. Reconnecting the same tab reactivates that archived connection
instead of creating duplicate history.

## Create and review a profile

On an administrator's dataset detail page, use **Partner exports** and choose
**New export profile**.

- **Joshua Project** starts with the fixed exchange contract described below.
- **Custom** starts with one mapped column and allows target headers to be
  added, removed, and reordered.
- Every output column maps to a stable source-column key. The saved source label
  is only a human-readable snapshot; column position and spreadsheet letters
  are never used to look up values.
- The crosswalk supports only deterministic transformations: copy and trim,
  first non-blank source, a fixed literal, lossless whole-number conversion,
  ISO-8601 date/timestamp conversion, and non-negative whole-number conversion.
  Formulas, scripts, SQL, remote lookups, and inferred semantic substitutions
  are not supported.

If a later dataset refresh removes a mapped source key, preview and generation
report the mapping as stale. Accelerate will not silently bind it to a similar
column.

## Joshua Project starter contract

The starter always produces these 13 headers in this order:

1. `PG_PeopleID3`
2. `PG_ROP3`
3. `Geo_ROG3`
4. `Geo_ISO3`
5. `PG_Name_Main`
6. `PG_Name_Alt`
7. `PG_AX_unique_PG_ID_PGIC`
8. `reporting_group`
9. `implementing_group`
10. `engage_timestamp_of_last_known`
11. `engage_status_of_engagement`
12. `approx_evangelical_believers`
13. `approx_evangelical_churches`

Suggestions are limited to case-insensitive exact source-header matches. An
unmatched target stays visibly unresolved; helper columns such as `index` and
`Row number` are never substituted or exported. This intentionally avoids
guessing that an aggregate or similarly named field means the same thing.

The starter applies these blocking rules to every row:

- `PG_AX_unique_PG_ID_PGIC` and `PG_Name_Main` must be present.
- At least one of `PG_PeopleID3` or `PG_ROP3` must be present.
- At least one of `Geo_ROG3` or `Geo_ISO3` must be present.
- Engagement timestamps must be unambiguous ISO-8601 dates or timestamps.
- Approximate believer and church counts must be unambiguous non-negative
  whole numbers.

Identifier values remain strings, including leading zeroes. Values such as
scientific notation, localized dates, fractions, and negative counts are
rejected rather than guessed or rounded.

## Preview, validate, and download

**Preview** runs the same mapping and validation engine used by generation. It
shows up to 25 ordered rows, the crosswalk, and row/field findings, but does not
write a CSV or create an export run.

Errors block generation. Warnings do not change any value, but the
administrator must explicitly acknowledge the current warnings before
generating. An export is limited to 100,000 source rows and a 25 MiB CSV.

**Generate CSV** records an immutable run snapshot containing the profile
revision, actor, source dataset and blob version, schema/content fingerprints,
row count, validation summary, output checksum, and timing. A successful run
stores three private artifacts:

- the CSV;
- the reviewed crosswalk and source provenance;
- the validation report.

Downloads always pass through the administrator-authorized Accelerate API.
There are no public Storage URLs. CSV cells use the application's formula
neutralization and escaping rules before storage, so a value cannot become an
active spreadsheet formula merely by opening the download.

## Version 1 boundaries

This workflow deliberately does not include Google user OAuth, Drive browsing,
scheduled exports, multi-dataset joins, email delivery, writing files back to
Google Drive, or delivery to a partner API. Version 1 is a service-account,
one-tab-at-a-time import followed by an explicit, private local download.
