## Context

The existing private registry is structurally capable of reservations, immutable revisions, and source bindings, but production authority is gated by a legacy AX Data import marker. The current service also reads source-supplied AX codes and can retain them. Source forming already resolves country aliases to canonical ISO3 and ROP3 to canonical ROP parents using pinned resources, so the clean authority can consume exact formed evidence instead of rebuilding source-specific normalization.

Production is expected to have no committed legacy authority. The schema change must nevertheless fail closed when any identity, code, binding, revision, or committed cutover exists. The application is deployed on Vercel while registry state and artifacts live in Supabase private schema/storage.

## Goals / Non-Goals

**Goals:**

- Initialize an empty AX Online authority as revision 1 through a state-bound CLI-only handshake.
- Issue the established AX code format from normalized current-source evidence only.
- Reuse exact current ROP3 across sources and ROP3+ISO3 for PGIC.
- Preserve bindings through ordinary data changes and review identity-component changes.
- Remove every executable AX Data and legacy identity import path.
- Keep revisions, reservations, decisions, artifacts, and publications atomic and auditable.

**Non-Goals:**

- Migrate, reserve, compare, or audit legacy AX Data identities.
- Match people by names, row positions, descriptions, or historical codes.
- Enable automatic scheduling/publication or browser-based authority activation.
- Add automatic aliases or a general-purpose entity-merging system.

## Decisions

### Forming owns source normalization; identity owns validation

Forming remains responsible for source-specific country aliases, canonical ISO3, and ROP parent normalization. Identity candidates accept a typed evidence projection and revalidate its canonical values against the exact resource versions pinned by the formed publication. This avoids duplicated fuzzy logic while detecting malformed or stale formed evidence.

Alternative: resolve source text again during identity assignment. Rejected because it creates two normalization authorities and can produce different results from the reviewed formed publication.

### Established codes remain component-based

PGAC is `<rop1-suffix>-<source-initials>-<six-digit>` and PGIC appends `-<ISO3>`. Valid ROP3 supplies the six-digit component and its pinned ROP1 parent. Without ROP3, the registry allocates from `000001`. `00` is used only when both ROP3 and canonical ROP1 are absent. A ROP3 whose resource entry lacks a valid ROP1 blocks assignment.

Alternative: introduce an opaque namespace. Rejected by product direction.

### ROP3 evidence is globally owned

One active PGAC owns one exact current ROP3 evidence value. Later sources with that ROP3 bind to the existing canonical identity; ROP3+ISO3 selects or creates the PGIC child. The first reviewed establishing source supplies canonical source initials. Simultaneous competing establishing sources require an explicit reviewer choice rather than processing-order selection.

### Old AX fields are outside identity evidence

Raw ingestion may preserve source payloads, but the identity evidence type cannot contain old AX code fields. Identity-enriched output writes only AX Online registry values. Static guard tests and behavioral invariance tests prevent reintroduction.

### Neutral activation replaces legacy cutover

A new private authority marker records revision 1, empty graph checksum, rules/formatter checksums, actor, reason, and state fingerprint. Dry run creates append-only activation evidence plus a single-use token. Commit locks the namespace, revalidates the zero state, creates revision 1 and the marker atomically, and leaves the counter at 1.

### Graph checksum controls revision creation

Identity publication computes the complete active graph checksum. If bindings, identities, codes, evidence ownership, and supersession state are unchanged, the current revision is reused. A new binding to an existing identity changes the graph and creates a revision. Data-only changes may still publish a dataset against the unchanged revision.

### Legacy removal is guarded, not destructive by assumption

The migration checks the production zero-state invariant before dropping legacy tables/functions/columns. Any committed or staged authority data raises an exception and leaves the schema unchanged. Exact legacy storage objects are deleted only after a read-only inventory and are not mixed with current candidate artifacts.

### Private schema remains the security boundary

Identity tables and privileged functions remain private, with RLS enabled, `public`/`anon`/`authenticated` access revoked, `PUBLIC` function execution revoked, and minimal service-role grants. Application permissions continue to derive from `raw_app_meta_data.workspace_role`; activation has no HTTP endpoint.

## Risks / Trade-offs

- **First-source initials can affect canonical text** → Simultaneous current sources sharing ROP3 require reviewer selection; provenance records every later binding.
- **Fresh allocation can textually collide with a current ROP3 code** → Construct complete codes under the allocation lock, skip/consume conflicting numbers, and block later unresolved ownership conflicts.
- **A forming regression could change identity components** → Revalidate formed evidence against pinned resources and surface all component differences as reviewed events.
- **Dropping legacy schema could erase unexpected state** → Migration aborts unless every authority table is empty and no cutover marker exists.
- **No fuzzy matching creates duplicate real-world entities without ROP3** → Accept separate identities until a future approved current-evidence reconciliation capability exists.
- **Large change crosses DB, service, UI, and scripts** → Deliver in verified slices, keep authority inactive through deployment, and activate only after full local and production dry-run evidence.

## Migration Plan

1. Add OpenSpec/test contracts and repository guards.
2. Add the guarded private-schema migration and neutral activation model.
3. Refactor rules/evidence/candidate publication and update downstream revision consumers.
4. Add activation CLI and update the review UI/docs.
5. Verify locally on a clean Supabase database, including failure/rollback tests.
6. Deploy with authority inactive and run production read-only zero-state preflight.
7. Remove exact legacy storage evidence, run activation dry run, review fingerprint, then commit revision 1 in an approved window.
8. Run IMB as the first manual source canary; continue one source at a time.

Before activation, rollback is application/database rollback with authority still inactive. After revision 1 exists, corrections are forward-only; revision 1 and its marker are immutable.

## Open Questions

None. Product decisions for matching, AX Data isolation, format, missing fields, and activation are approved.
