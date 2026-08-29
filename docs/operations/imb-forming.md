# IMB ingestion and forming

IMB uses a three-stage admin workflow: ingest source evidence, build a formed
candidate, then publish or reject it. Ingestion alone never creates or replaces
the workspace IMB dataset.

## Ingest source evidence

Run **Start ingestion** from the IMB connection. A successful run stores two
private, checksummed artifacts: normalized source rows and the redacted raw
response. These artifacts are the immutable input to formation. Test runs,
failed runs, historical runs without checksums, and other connection providers
cannot start an IMB candidate.

ArcGIS page zero is retained only after the provider establishes object-ID
ordering. If the first response is needed to discover the object-ID field, the
provider discards it and fetches page zero again in that stable order.

## Build and review a candidate

Open a successful ingestion in **Run history**, then select **Build formed
candidate**. The background build pins all of these inputs:

- source connection, run, and artifact checksums;
- the exact Country/ROG and ROP resource-set versions;
- the IMB field-contract version and checksum; and
- the transformation version and checksum.

The builder preserves every source row, uses ArcGIS `OBJECTID` for stable row
lineage, applies the versioned field contract, resolves exact country and ROP3
matches, and records structured findings. Raw source evidence is never edited.

Warnings preserve the row and do not block publication. Examples include an
unresolved country or ROP3, a source/canonical hierarchy disagreement, schema
drift, or an invalid optional value. Errors make the candidate invalid; examples
include missing required columns, missing or duplicate `OBJECTID`, ambiguous
reference data, row-count divergence, or an artifact checksum mismatch.

The run detail shows a bounded finding preview. Use the Findings, Manifest, and
Formed CSV downloads for the complete immutable review package.

## Publish, reject, retry, and roll back

A valid candidate requires a written reason before publication. When warnings
exist, the admin must explicitly acknowledge them. The first publication creates
and binds the IMB workspace dataset; later publications use the dataset's normal
version archive and replace behavior.

Historical API-run artifacts may be cataloged as cold after archive, restore,
dependency, latest-three, and operator approval checks. Cold artifacts remain
visible in run history but cannot be downloaded or used to start new forming
work. An operator must rehydrate and verify the exact package first; Vercel does
not contact Samson during the request.

A valid or invalid undecided candidate can be rejected with a reason. Invalid or
failed builds can be rebuilt against the then-current reference set; the prior
attempt remains in history. A failed publication returns the immutable candidate
to a retryable valid state and displays the normalized failure.

Rollback uses the existing dataset version controls. Rolling back dataset rows
does not alter candidate history, source artifacts, findings, or resource-set
bindings.

This first implementation does not merge IMB with other sources, perform fuzzy
matching, allocate AX codes, or aggregate cross-source records.
