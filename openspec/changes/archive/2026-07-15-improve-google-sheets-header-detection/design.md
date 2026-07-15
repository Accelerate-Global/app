## Context

The Google Sheets provider currently calls `parseGoogleSheetsValuesToRows`, which selects `values.findIndex(rowHasValue)` as the header. Real partner workbooks often place a report title, instructions, or numeric column guide above the actual header. The supplied Sudan and Lao structures both use row 4 as the 65-column header and begin data on row 5, while the current behavior imports rows 2-4 as data and produces generic columns.

Connection setup currently checks spreadsheet metadata and lets an administrator choose tabs, but it does not fetch a bounded values preview or persist parsing intent. The detail client polls run state, but its server-supplied `connection.targetDatasetId` remains stale after a background import succeeds.

The change crosses Google API reads, provider configuration, parsing, admin routes, React state, and browser smoke coverage. It does not broaden authorization or expose service-account credentials. Provider configuration stays in the existing private JSON column, so no public schema or RLS change is required.

## Goals / Non-Goals

**Goals:**

- Recommend the correct single header row deterministically from a bounded preview.
- Let an administrator explicitly select one header row or combine one-to-three consecutive rows and preview the result.
- Persist confirmed parsing intent and protect it from silent semantic drift.
- Preserve compatibility for existing Google Sheets connections that predate header configuration.
- Exclude all rows above and including the selected header band from data.
- Make a successful background import update its final message and dataset navigation without a browser reload.

**Non-Goals:**

- LLM inference, semantic partner-field mapping, Google OAuth, Drive browsing, multi-tab joins, or arbitrary formulas.
- Automatically combining multiple title-like rows; composition is explicit.
- Committing private source rows or source identifiers as fixtures.
- Changing dataset admin authorization, service-account scope, Storage exposure, or same-origin mutation controls.

## Decisions

### Detect one recommended row from a bounded values preview

Connection setup will fetch at most the first 25 non-truncated Sheet rows for a selected tab. Each non-empty row is scored using populated-column coverage, non-numeric text ratio, normalized uniqueness, recognized header vocabulary, average label shape, and compatibility with following rows. Sparse title rows and numeric/sequential guide rows receive explicit penalties. The highest candidate is returned with a score margin and `high`, `medium`, or `low` confidence.

This is deterministic, auditable, private, and testable. LLM inference was rejected because it would transmit private labels, vary between runs, add latency/cost, and still require a safe override.

### Keep automatic recommendation separate from confirmed selection

The preview response contains candidates and a recommended single row, but the connect request contains the administrator's actual selection. Newly created connections persist:

- selection mode: `auto` or `manual`;
- header start/end rows as one-based Sheet row numbers;
- normalized composed header fingerprint;
- normalized header labels used at confirmation;
- detector confidence and confirmation timestamp.

Choosing a different row or any multi-row range marks the selection manual. Manual selections always win over later recommendations.

### Support explicit one-to-three-row composition

The UI defaults to one row. An advanced control can select a consecutive range of up to three rows. Composition works column-by-column, top to bottom: trim whitespace, ignore blank and purely numeric guide values, expand bounded merged group labels when Sheet merge metadata identifies their span, remove repeated normalized fragments, then join remaining fragments with ` / `. Existing header normalization still supplies stable unique keys and `Column N` fallbacks.

Arbitrary non-consecutive rows were rejected because they are difficult to explain, preview, fingerprint, and relocate safely.

### Persist a fingerprint and relocate only exact matches

At run time the configured row/range is recomposed. If its fingerprint matches, parsing proceeds. If not, the provider scans the bounded preview for exactly one range of the same height with the stored fingerprint. A unique exact match is treated as a safe row insertion/removal and parsing proceeds from the relocated range. Zero or multiple matches fail before output or dataset mutation with an actionable review error.

Existing connections without header configuration use the deterministic recommendation for compatibility. High-confidence results may run; ambiguous results fail with a request to review the header. Saving from the detail screen converts the connection to the protected persisted model.

### Use provider-specific admin routes for preview and updates

The existing access-check response remains metadata-focused. A provider-specific header-preview route accepts the already validated Google Sheet URL plus stable `sheetId`, resolves the current title, reads the bounded preview, and returns candidates, composed labels, and sample rows. The connect route accepts one selection per selected sheet and revalidates/fingerprints each selection server-side.

The existing connection route gains an admin-only header-selection update operation. It re-fetches the Sheet and persists only a server-validated selection; clients cannot submit trusted fingerprints or labels. Same-origin and admin guards remain centralized through `withRoute`.

### Refresh server state once when an import reaches a terminal state

When polling observes an import transition from queued/running to success, the client updates the message from queued to the final result and calls `router.refresh()` once. The refreshed server component supplies the connection's new `targetDatasetId`, causing **Open dataset** to render. Failed runs update the message without refreshing unrelated connection state.

### Keep fixtures synthetic and verification layered

Tests will model the structural pattern only: sparse report rows, numeric guides, a 65-column textual header, genuine two-row composition, and data rows. The attached source contents will not enter the repo. Unit tests cover scoring/composition/fingerprints; provider and route tests cover revalidation; component tests cover selection and refresh; targeted UI smoke covers the interactive surfaces.

## Risks / Trade-offs

- [Heuristics select a plausible data row] → Require confidence margins, show a preview, make overrides easy, and block ambiguous legacy imports.
- [A real header is mostly numeric] → Manual selection remains available; confirmed numeric labels are preserved except numeric-only values inside explicit multi-row composition where they act as guide values.
- [Merged metadata is unavailable or incomplete] → Composition remains deterministic from values and the preview exposes the exact result before save.
- [Header text changes intentionally] → Fingerprint mismatch blocks mutation until an administrator reviews and confirms the new selection.
- [Fetching previews for many tabs adds Google API calls] → Fetch only when a tab is selected or its header editor opens, cap rows, cache client results for the current setup session, and do not preload every tab.
- [Existing connections lack persisted selections] → Use high-confidence compatibility detection, expose review on detail, and explicitly remediate the current Sudan connection after deployment.
- [Router refresh repeats during polling] → Track terminal run IDs already refreshed and refresh once per successful import.

## Migration Plan

1. Deploy backward-compatible provider config parsing that accepts missing header selection.
2. Deploy preview/update routes and UI controls.
3. Existing connections continue to load; high-confidence legacy runs detect a header, while ambiguous runs stop safely.
4. Review and save the current Sudan connection header as row 4, then run a refresh that replaces the existing target dataset through normal version history.
5. Verify corrected column labels and 126 non-empty data rows in production.
6. Rollback by redeploying the prior application version; persisted JSON additions are ignored by older code. Existing dataset version history preserves the prior dataset snapshot.

## Open Questions

None. The approved UX defaults to automatic single-row recommendation, exposes an explicit manual row selector, and makes multi-row composition an advanced opt-in.
