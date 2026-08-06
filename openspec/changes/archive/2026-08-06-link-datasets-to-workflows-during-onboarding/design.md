## Context

Google Sheets onboarding already reviews exact spreadsheet and tab identity, selected headers, dataset names, classification, and access before creating connections. Tier 1 configurable source profiles and Tier 2 partner profiles are currently configured later through separate administrator surfaces. This separation is why Final-58 and Final-Sudan can be connected datasets without being runnable Tier 2 inputs.

The existing Tier 2 schema treats `partner_key` as globally unique. That does not model the confirmed domain correctly: Final-58 and Final-Sudan are distinct engagement feeds managed by the same owner, Accelerate. The durable feed identity belongs in the unique `profile_key`; `partner_key` identifies the shared owner and remains the source-alias key used by identity reconciliation.

## Goals / Non-Goals

**Goals:**

- Offer an optional, understandable workflow assignment for every selected Google Sheet tab during onboarding.
- Use only reviewed Sheet headers for durable row-key and tracking-column selections.
- Create the connection and its Tier 1 binding or Tier 2 profile atomically before the initial import begins.
- Represent multiple Tier 2 feeds under one owner without weakening unique feed or Sheet-tab identity.
- Keep ordinary unlinked dataset onboarding and CSV onboarding unchanged.

**Non-Goals:**

- Guessing workflow assignments or identity columns from names.
- Automatically approving or publishing formed, identity, Tier 2, or Aggregate 2 candidates.
- Automatically retrofitting existing connections without administrator review of their columns.
- Moving API credentials through browser payloads or repository files.

## Decisions

### Store one optional workflow assignment per selected tab

Onboarding state will retain a per-`sheetId` assignment. A tab can remain unlinked, select one of the two supported Tier 1 source profiles, or define one Tier 2 engagement-feed profile. This matches the connection granularity: one connection represents one stable spreadsheet/tab.

Alternative considered: one workflow selection for the whole spreadsheet. That fails when a spreadsheet contains tabs with different meanings and would couple unrelated connection identities.

### Collect semantic configuration from reviewed headers

Stable row-key, tracking ID, and optional evidence columns will be selected from the confirmed header list. Tier 2 also selects one active owner from the source-alias registry and collects a feed name and tracking-ID type. The feed profile key is normalized from the reviewed feed name; the owner key comes from the selected active registry entry. The final review shows the owner and feed labels, while the server validates the stable keys and never infers a workflow from dataset names.

Alternative considered: exposing the existing raw Tier 2 profile JSON editor during onboarding. That is error-prone, requires administrators to know checksums and internal identifiers, and does not meet the product's guided-onboarding standard.

### Resolve the Tier 2 contract server-side

The connection endpoint will resolve the active valid `engagement-mappings` resource version and checksum while creating a Tier 2 profile. The browser will not submit or select internal contract checksums. If the contract is absent or stale, the entire connection/workflow transaction fails before any connection is created.

### Commit connections and workflow links atomically

The existing Google Sheets connection transaction will validate all requested assignments, create/reactivate every selected connection, then insert the corresponding private Tier 1 bindings or Tier 2 profiles in the same transaction. Duplicate profile keys, conflicting Tier 1 profiles, invalid columns, missing contracts, or duplicate Sheet identities roll back the complete selection. Initial imports start only after this transaction returns successfully.

Alternative considered: calling the existing profile APIs from the browser after connection creation. That would leave partially configured connections when the second request fails and could start an import before its workflow identity exists.

### Let several feed profiles share one owner key

A migration will remove the unique constraint on `private.tier2_partner_profiles.partner_key`, while preserving unique `profile_key` and unique `(spreadsheet_id, sheet_id)`. Collection validation will continue to reject duplicate profile keys and Sheet identities but will permit repeated partner/owner keys. Identity reconciliation continues using the shared owner key against the pinned source-alias resource.

### Keep private configuration private

Workflow configuration remains behind the existing administrator route guard and private-schema tables. Existing RLS, revokes, same-origin mutation protection, and service-role access remain unchanged. No credential is included in this change.

## Risks / Trade-offs

- **A user chooses the wrong semantic column** → The UI shows the exact choices in final review, the backend validates that every selected column exists in the confirmed header, and downstream forming still fails closed on ambiguous identity evidence.
- **A selected owner is no longer active by commit time** → Identity reconciliation would later stop. To prevent delayed failure, the server revalidates the submitted owner key against the active source-alias resource before committing a Tier 2 profile.
- **Existing code assumes one profile per owner** → Focused profile, release, identity, and database tests will cover multiple profiles sharing one owner key.
- **Schema rollback encounters duplicate owner keys** → Rollback requires removing or reassigning additional profiles before restoring the unique constraint. The forward migration is otherwise metadata-only and preserves existing rows.
- **Mixed workflow types share one global dataset classification** → The server enforces PGIC for linked Tier 1 profiles and PGAC for linked Tier 2 profiles per created connection, while unlinked tabs retain the reviewed global classification.

## Migration Plan

1. Apply the private-schema migration that drops only the Tier 2 `partner_key` uniqueness constraint.
2. Deploy backend validation and atomic connection/workflow creation.
3. Deploy the guided onboarding controls and review summary.
4. Verify ordinary, Tier 1, Tier 2, multi-tab, duplicate, missing-contract, and rollback behavior locally.
5. Existing connections remain unchanged. Final-58 and Final-Sudan can be linked through an explicit reviewed follow-up rather than guessed during deployment.

Rollback removes the onboarding controls and API assignment input. Existing workflow profiles remain valid. Restoring one-profile-per-owner requires an explicit data cleanup before re-adding the prior unique constraint.

## Open Questions

None. Confirmed domain language is: Accelerate-owned people groups is a Tier 1 source; Final-58 and Final-Sudan are separate Accelerate-managed Tier 2 engagement feeds.
