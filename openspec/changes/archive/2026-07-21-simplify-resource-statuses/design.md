## Context

The Resources page currently requests admin candidate state and prints the raw `valid-candidate`, `invalid-build`, or `interrupted-build` value on each catalog card. That makes the status of an inactive candidate look like the health of the active resource. The ROP table likewise treats the intentionally generated `parent-only-rop25` row type as a join warning and reports browser pagination as a “loaded of total” badge.

The reported ROP refresh failure is reproducible against the live HIS ArcGIS layers. The source currently returns 8,991 ROP25 rows, while `src/lib/rop-codes.ts` rejects any result below the historical round-number floor of 9,000. The 24-row decrease from the checked-in 9,015-row resource is not a suspicious truncation. Once that obsolete floor is corrected, validation correctly identifies a separate upstream integrity issue: ROP25 `303439` points to absent ROP2 `C0326`, and ROP3 `117966` depends on that chain.

## Goals / Non-Goals

**Goals:**

- Make resource catalog cards communicate the active usable resource, not inactive candidate state.
- Keep genuine candidate validation and failure details available in the admin lifecycle surface.
- Remove pagination implementation detail from the ROP summary.
- Present ROP25-only hierarchy rows as expected data, while retaining warnings for actual missing-parent and conflicting-parent joins.
- Accept the current complete HIS ROP25 layer through the count safeguard without weakening the large-drop protection, while continuing to reject its genuine orphan parent link.

**Non-Goals:**

- Do not activate a new candidate automatically.
- Do not erase failed candidate history or hide lifecycle findings from administrators.
- Do not change ROP row inclusion, downloads, search, auth, permissions, database schema, or API method contracts.

## Decisions

1. **Stop requesting and rendering candidate attention state on the Resources catalog page.** The page will continue to show active version metadata and “No active version” when the actual usable resource is unavailable. Candidate review remains on each resource detail page. This is clearer than translating or recoloring the raw candidate status because catalog health and candidate lifecycle are different concepts.

2. **Suppress warnings only for `parent-only-rop25`.** The row remains present and its ROP3 cell remains “Not listed.” `missing-rop25` and `rop2-conflict` continue to surface warning icons and detail badges because those represent imperfect source joins rather than an expected hierarchy level without children.

3. **Remove only the browser-page count badge.** ROP1, ROP2, ROP25, and ROP3 source counts and retrieval time remain visible because they describe the resource itself. Cursor pagination and “Load more” behavior remain unchanged.

4. **Lower the ROP25 completeness floor from 9,000 to 8,500 without weakening hierarchy validation.** This allows the verified 8,991-row source to reach the next validation stage while still rejecting a source response more than roughly five percent below the checked-in 9,015-row baseline. The current live build is expected to remain invalid because the independent `303439` → `C0326` orphan link is a genuine source-integrity failure. A focused regression test records the production-shaped count boundary, and live reproduction confirms the integrity error remains enforced.

## Risks / Trade-offs

- **A future incomplete ROP25 response between 8,500 and 8,990 rows could pass the count floor** → Duplicate and hierarchy validation remain active—as confirmed by the current orphan-link rejection—and candidate activation still requires explicit admin review rather than replacing the active resource automatically.
- **Catalog cards no longer announce a waiting candidate** → The detail-page lifecycle control remains the authoritative review surface and preserves all findings and history.
- **Parent-only rows no longer carry a visible warning affordance** → Their missing ROP3 value remains explicit as “Not listed,” while genuine join anomalies retain their warnings.

## Migration Plan

No database or data migration is required. Deploy the rendering and threshold changes together. A later admin refresh will become valid only after HIS repairs the orphan ROP2 relationship; until then, the active version remains usable and the invalid candidate remains available as audit history without appearing as catalog-card health. Rollback is a normal code rollback because no persisted schema or active version is mutated by this change.

## Open Questions

None.
