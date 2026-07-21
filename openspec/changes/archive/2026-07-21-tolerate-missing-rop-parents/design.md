## Context

The HIS source currently contains one internally inconsistent hierarchy: ROP25 `303439` and its ROP3 child `117966` reference ROP2 `C0326`, but the ROP2 layer does not publish `C0326`. The current validator throws before a normalized resource can be built, so the candidate lifecycle records a generic invalid source refresh even though only one chain is affected. The active version remains safe, but all unrelated current HIS changes are prevented from reaching candidate review.

The existing resource model already tolerates a missing ROP25 reference with a synthetic “Not listed” term and a join-issue marker. The candidate lifecycle also treats warning-only findings as valid while still requiring explicit admin activation. Those patterns can be extended to missing ROP2 parents without a schema migration.

## Goals / Non-Goals

**Goals:**

- Preserve valid ROP25, ROP3, and geography data when a small number of ROP2 parents are absent.
- Surface the referenced missing ROP2 code and a genuine warning without inventing a replacement parent.
- Allow warning-bearing candidates to complete and become reviewable.
- Retain a hard failure for widespread or otherwise dangerous hierarchy corruption.

**Non-Goals:**

- Do not map `C0326` to the prior `C0328` classification automatically.
- Do not auto-activate a warning-bearing candidate.
- Do not relax missing ROP1, duplicate-code, source-count, checksum, projection, or artifact-integrity validation.
- Do not change database schema, RLS, auth metadata, API permissions, or Vercel configuration.

## Decisions

1. **Represent the missing parent as an explicit `missing-rop2` join issue.** The affected normalized row will contain a placeholder ROP2 term using the source code and “Not listed” name, no ROP1 term, and its original ROP25/ROP3 data. This preserves the source assertion without creating a catalog ROP2 definition.

2. **Bound tolerance by both count and ratio.** Missing ROP2 parents are warning-eligible only when there are no more than 10 distinct affected ROP25 records and they represent no more than 0.1% of the ROP25 layer. Exceeding either limit remains a fatal source-build error. Missing ROP1 references remain fatal because they affect a higher shared taxonomy level.

3. **Create one structured warning per visible affected hierarchy row.** Refresh preparation will translate `missing-rop2` rows into candidate findings with the stable row key, ROP25 code, and unresolved ROP2 code. Warning-only findings produce a valid candidate under the existing lifecycle; errors still produce an invalid candidate.

4. **Allow the bounded placeholder through package validation without materializing a fake ROP2 term.** The people projection and CSV retain the unresolved code and join issue, while the ROP term projection remains limited to actual source ROP2 definitions. This naturally prevents higher-level ROP1 aggregation for the unresolved row.

5. **Keep the warning visible as actionable.** The earlier UI cleanup suppresses only expected `parent-only-rop25` warnings. A missing ROP2 is a genuine anomaly, so its table icon and detail label remain visible to reviewers.

## Risks / Trade-offs

- **Unresolved codes can appear in row-level exports without a matching ROP2 term definition** → The join-issue column and structured finding identify the condition, and ROP1 remains empty instead of being guessed.
- **A growing source problem could be normalized as warnings** → Both the absolute and ratio thresholds stop the build before tolerance becomes widespread.
- **Users may activate a candidate containing a known warning** → Activation remains an explicit dataset-admin action with a reason, and lifecycle findings are shown before activation.
- **The upstream source may later publish `C0326`** → A subsequent refresh resolves the placeholder automatically through the normal parent lookup and removes the warning.

## Migration Plan

No database migration is required. Deploy the code and spec changes together. After production deployment, rerun the ROP refresh: the current one-row orphan should produce a valid candidate with one warning instead of an invalid build. Do not auto-activate it during deployment. Rollback is a normal code rollback; existing active and candidate versions remain preserved.

## Open Questions

None.
