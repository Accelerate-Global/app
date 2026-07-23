# AX Data flow inventory and AX Online stage map

Status: reviewed legacy inventory reconciled with the implemented AX Online
pipeline definitions. This document records supported behavior; the operator
runbook remains authoritative for whether a profile is configured and runnable
in a particular environment.

This inventory characterizes the older AX Data checkout without making it a
runtime dependency. Legacy citations are relative to
`/Users/blake/Documents/accelerate-global/data`; online citations are relative
to this repository. No retained production row or credential is copied here.

## Evidence labels

| Label | Meaning | Publication effect |
| --- | --- | --- |
| `confirmed by code` | The executable legacy path implements the rule. | May be ported after a matching fixture exists. |
| `confirmed by fixture` | A sanitized checked-in case and golden output freeze the approved result. | May be promoted to a direct engine/product test. |
| `documented only` | A doc or comment claims the rule, but executable evidence is absent or incomplete. | Must not enable publication by itself. |
| `conflicting` | Code, docs, retained behavior, or current product intent disagree. | Blocks the affected future engine/product until the decision log is approved. |
| `unused` | Stub, missing script, superseded branch, or output with no canonical downstream consumer. | Must not be ported as authoritative behavior. |

## Online stage contract

| Online stage | Immutable input | Output | Review/publication rule |
| --- | --- | --- | --- |
| Ingestion snapshot | One configured provider/profile execution | Raw and parsed artifacts, checksums, logs | Never implies that source data is curated. |
| Forming candidate | One exact ingestion snapshot plus engine/resource/contract bindings | Normalized rows, columns, findings, lineage, artifacts, checksum | Errors block; warnings require review; no dataset write. |
| Identity candidate | One exact published formed version plus registry snapshot/reservations | PGAC/PGIC assignments, aliases, conflicts, registry effects | Conflicts block; reservations become active only with controlled publication. |
| Merge candidate | One release set of exact identity-enriched versions | Deterministic field winners, provenance, findings, checksum | Missing inputs, duplicate bindings, ambiguous identity, or priority ties block. |
| Aggregate candidate | One exact parent version plus rule/resource checksum | One named product with lineage and comparison totals | A newer parent marks it out of date but never mutates it. |
| Publication | One valid reviewed candidate | Stable workspace dataset target plus archived version | Explicit administrator action; failure cannot create a false published state. |

The current online ingestion seam is `src/lib/api-connections/provider.ts`, run
and artifact persistence is in `src/lib/api-connections/index.ts`, dataset
versioning is in `src/lib/datasets.ts`, and immutable resources are in
`src/lib/reference-resources/`. IMB's existing forming implementation in
`src/lib/imb-forming/` is the compatibility baseline for the shared lifecycle.

The deployed definition registry now exposes five Tier 1 source flows,
`tier1-release`, `tier1-full`, one profile-scoped `tier2-partner` flow, and
`tier2-release`. IMB, Etnopedia, and Joshua Project use code-managed profiles.
WCD and Accelerate-owned Sheets remain unavailable until an administrator binds
an active Sheet/tab connection and durable stable-key column. Tier 2 support is
available, but no partner is implied: one active profile and reviewed contract
must be configured per partner.

## Source and forming flows

| Flow | Legacy acquisition | Ordered forming behavior | Resources/validation | Evidence | AX Online mapping |
| --- | --- | --- | --- | --- | --- |
| Accelerate-owned (AX) | Google Sheets/local export by tab/prefix in `tier_1/00_incoming_datasets/accelerate_api_request_local.py` | `00_ax_local_ids.py` → `01_ax_local_fields.py` → `02_ax_local_iso3.py` → `03_ax_local_country_name.py` → `06_ax_local_data_types.py` → `07_ax_local_dup_check.py`; numeric discovery is implemented by `tier_1/03_processing/ax/run_ax_pipeline.py` | AX field map, Database Sources aliases, ISO/country, add-on fields, semantic types; duplicate check is validation-only | `confirmed by code`; ordinary/alias/schema/duplicate cases `confirmed by fixture` | Admin-managed Google Sheets source profile → generic forming engine → explicit curated dataset publish. |
| Etnopedia (ETNO) | MediaWiki export in `tier_1/00_incoming_datasets/etnopedia_export_people_csv.py` | `00_etno_ids.py` → `01_etno_fields.py` → `02_etno_find_country.py` → `03_etno_iso3.py` → `04_etno_rop1.py` → `06_etno_data_types.py`; numeric discovery in `tier_1/03_processing/etno/run_etno_pipeline.py` | ETNO parse/field map, ISO/country, ROP hierarchy, semantic types | Main steps `confirmed by code`; blank/unmapped ROP3 preservation and UUID identity `confirmed by fixture` and DEC-002 | Existing Etnopedia connection → versioned engine → identity candidate → explicit publish. |
| IMB people groups | ArcGIS paging in `tier_1/00_incoming_datasets/imb_api_request_points.py` | `00_imb_ids.py` → `01_imb_fields.py` → `02_imb_iso3.py` → `03_imb_country_name.py` → `06_imb_data_types.py` → `07_imb_dup_check.py`; numeric discovery in `tier_1/03_processing/imb/run_imb_pipeline.py` | IMB field contract, ISO/country, ROP, semantic types, duplicate checks | Legacy flow `confirmed by code`; current online output covered by existing IMB tests; generic adapter parity is a separate foundation gate | Existing ArcGIS ingestion → shared forming engine → explicit curated dataset publish. |
| Joshua Project (JP) | HTTPS API in `tier_1/00_incoming_datasets/joshua_project_api_request_pgic.py` | `00_jp_ids.py` → `01_jp_fields.py` → `02_jp_iso3.py` → `03_jp_country_names.py` → `06_jp_data_types.py` → `07_jp_dup_check.py`; numeric discovery in `tier_1/03_processing/jp/run_jp_pipeline.py` | JP field map, Database Sources, ISO/country, semantic types; duplicate domain key `(PG_ROP3, Geo_ISO3)` | `confirmed by code`; normal and duplicate cases `confirmed by fixture` | Existing Joshua Project connection → engine → explicit curated dataset publish. |
| World Christian Database (WCD) | Private Sheet ingestion in `tier_1/00_incoming_datasets/wcd_api_request.py` | `00_wcd_ids.py` → `01_wcd_fields.py` → `02_wcd_iso3.py` → `03_wcd_country_names.py` → `06_wcd_data_types.py` → `07_wcd_dup_check.py`; numeric discovery in `tier_1/03_processing/wcd/run_wcd_pipeline.py` | WCD field map, ISO/country, types, duplicate domain key; `ROP People code` falls back into `PG_ROP3` in `tier_1/03_processing/wcd/_wcd_common.py` and field steps | `confirmed by code`; fallback and duplicate cases `confirmed by fixture` | Admin-managed private Google Sheets source profile → engine → explicit curated dataset publish. |
| Tier 2 engagement partners | Configured partner Sheets selected by `tier_2/01_sources/engagement_data_picker.py` | `00_engagement_partners_ids.py` → `01_engagement_partners_local_fields.py` → `02_engagement_partners_iso3.py` → `03_engagement_partners_country_name.py` → `04_engagement_partners_rop3.py` → `05_engagement_partners_rop1.py` → `08_engagement_partners_data_types.py`; numeric discovery in `tier_2/03_processing/engagement_partners/run_engagement_partners_pipeline.py` | Engagement field/template map, ISO/country, ROP, JP PeopleID3, PEID; `tracking_id_source` chooses the identifier family | Stage order `confirmed by code`; exact namespace and existing-ROP3 conflict behavior `conflicting` | One durable source profile per partner → forming → identity → one stable curated dataset per profile. |

### Common source findings frozen by fixtures

`tests/fixtures/pipelines/source-inputs.json` and `expected-output.json` freeze
these foundation expectations (`confirmed by fixture`): missing stable keys and
invalid semantic types are errors; known country aliases normalize; unknown
countries are visible findings; WCD's explicit ROP fallback is preserved;
duplicate source/ROP3/ISO3 keys block; schema drift is visible; and absent ROP3
routes toward UUID identity rather than being silently assigned a fake ROP3.
ETNO preserves a structurally readable row with blank/unmapped ROP3, emits a
visible finding, and routes the row to stable-key UUID identity as approved by
DEC-002. It does not silently drop the row or match it by name.

## Identity flows

| Rule | Legacy evidence | Evidence | AX Online replacement |
| --- | --- | --- | --- |
| ROP3-backed PGAC | `tier_1/05_ax_code/01_apply_ax_code.py::compute_ax_codes` uses last two ROP1 digits, normalized source initials, and six-digit ROP3 | `confirmed by code`; `rop3-derived` `confirmed by fixture` | Pure deterministic identity function pinned by rule checksum. |
| ROP3-backed PGIC | The same function appends normalized ISO3, using `XXX` when absent | `confirmed by code`; fixture covers normal ISO3 | Same pure function; unknown geography remains a finding. |
| Source aliases | `build_source_alias_map` and `normalize_data_source` in `tier_1/05_ax_code/01_apply_ax_code.py` read Database Sources initials/aliases | `confirmed by code` | Versioned source-alias resource. |
| ROP3 alias history | `determine_updates` plus ROP3 ledger update in `tier_1/05_ax_code/01_apply_ax_code.py` retain prior primary values in alias slots | `confirmed by code` | Transactional registry alias rows, never mutable CSV slots. |
| No-ROP3 matching | `tier_1/05_ax_code/02_update_uuid_ledger.py::update_ledger_with_source` matches only by `Dataset_Row_Key` | `confirmed by code`; ledger reuse `confirmed by fixture` | Stable source binding in the private registry. |
| UUID reuse/mint | The same function retains a valid source UUID, otherwise reuses the ledger or mints the next six-digit value | `confirmed by code`; reuse/mint/invalid/conflict cases `confirmed by fixture` | Transactional allocator; conflicts block instead of rewriting registry truth. |
| Missing row key | The legacy updater skips and warns | `confirmed by code`; `missing-row-key` `confirmed by fixture` | Blocking identity finding; no allocation. |
| Existing PGAC/PGIC | The no-ROP3 updater writes only when blank unless `--reconcile`; the ROP3 updater can rotate values into aliases | `conflicting` across branches | Registry canonical value is authoritative; explicit reconcile is a future reviewed operation (DEC-003). |
| Tier 2 identity | `tier_2/05_ax_code/{01_apply_ax_code.py,02_update_uuid_ledger.py,03_update_source.py}` repeats the three-stage ledger flow | `confirmed by code`; namespace relationship `conflicting` | Reuse one transactional registry with the approved subject/namespace rule (DEC-004). |

The canonical legacy orchestrator is
`tier_1/05_ax_code/run_ax_code_pipeline.py`: apply deterministic codes, update
UUID ledger, then update/promote source. Tier 2 has the same three steps in
`tier_2/05_ax_code/run_ax_code_pipeline.py`. Google Sheets and CSV ledgers are
migration inputs only, not online runtime stores.

## Merge flows and derived fields

| Product/rule | Legacy evidence | Evidence | AX Online mapping |
| --- | --- | --- | --- |
| Tier 1 merged people groups | `tier_1/06_merging/01_merge_people_groups.py` groups by detected AX PGIC and selects each field by priority | `confirmed by code`; cross-source winners/provenance `confirmed by fixture` | Exact release set + merge candidate keyed by canonical PGIC. |
| Tier 1 missing-priority fallback | `best_by_priority` uses JP → IMB → AX → ETNO → WCD when a field has no mapping | `confirmed by code`; fallback finding `confirmed by fixture` | Preserve order, but emit a finding for every fallback field. |
| Field provenance | Merge output creates `src__<field>` and drops `Data_Source` | `confirmed by code`; fixture freezes provenance | Persist private provenance artifact and expose reviewed consumer columns. |
| Specific PG merge | `tier_1/06_merging/02_merge_specific_pgs.py` keys by normalized ROP3 + ISO3 and retains `Contributing_Sources` | `confirmed by code` | Separate named candidate bound to the same exact release set. |
| Duplicate source binding | Legacy selection can depend on stable/source order when a source repeats a key | Target behavior `confirmed by fixture` | Blocking error; never silently choose one duplicate. |
| Workers needed | `tier_1/06_merging/05_workers_needed.py` calculates `ceil(PG_Population / 50000)` | `confirmed by code`; aggregate fixture covers rounding above zero | Versioned derived rule; invalid population produces blank plus finding. |
| Tier 2 merge | `tier_2/06_merging/01_merge_people_groups.py` stacks rows; duplicate AX codes are logged and retained | Legacy `confirmed by code`; approved blocking replacement `confirmed by fixture` | Exact multi-partner release set; duplicate canonical code blocks publication (DEC-005). |

`tier_1/06_merging/run_merging_pipeline.py` discovers
`01_merge_people_groups.py`, `02_merge_specific_pgs.py`, and
`05_workers_needed.py` numerically. Its Drive/latest discovery is operational
legacy behavior, not part of the data contract; AX Online binds explicit input
versions.

## Aggregate and named publication flows

| Product | Input and rule | Evidence | Intended online publication |
| --- | --- | --- | --- |
| PGAC Aggregate 1 | `merge_workflows/tier_1_pgac.py`: group specific PGs by ROP3; sum population; population-weight Christianity percentages; choose highest-population primary country; keep alternatives/source flags; `Joint` only when all five Tier 1 sources contribute | `confirmed by code`; weighted math, country choice, flags, and worker result `confirmed by fixture` | Named aggregate candidate from one exact specific-PG version. |
| PGAC Self-Engaged | `merge_workflows/tier_1_pgac_self_engaged.py`: GSEC ≤2, not frontier, believer/percent gates, then AX phase ≥6 or ≥1% evangelical | `confirmed by code`; percent branch and unavailable non-AX phase `confirmed by fixture` | Named child candidate with rule checksum. |
| Watchlist | `merge_workflows/tier_1_pgac_watchlist.py`: provenance-aware IMB GSEC and JP frontier gates plus believer and evangelical thresholds | `confirmed by code`; low and 1% boundary cases `confirmed by fixture` | Named child candidate with rule checksum. |
| Baseline UUPG List | `merge_workflows/baseline_uupg_list.py`: derive unengaged list from Watchlist with engagement/JP-frontier rule | `confirmed by code`; no dedicated foundation fixture beyond upstream classification | Named child from one exact Watchlist version. |
| Baseline UUPG Hotspots | `merge_workflows/baseline_uupg_hotspots.py`: sum population by primary country, deterministic top 10 | `confirmed by code` and tests in `tests/test_baseline_uupg_hotspots.py` in AX Data | Named child from one exact Baseline version, alphabetical tie-break. |
| South Asia | `merge_workflows/south_asia.py`: filter Aggregate 1 by explicit normalized country set | `confirmed by code` | Named child with a pinned scope contract/resource. |
| Aggregate 2 | `aggregate_2/agg_2.py`: stack Tier 2 plus independently selected IMB/JP inputs, keep all duplicate-code rows, emit provenance variants | `confirmed by code`; product meaning/name `conflicting` | Exact release-set inputs; duplicate canonical identity blocks; product name must describe approved stack/merge semantics (DEC-008). |

All legacy Google Sheet/Drive uploads and timestamped archives are publication
transport, not the online source of truth. AX Online publications use stable
dataset targets and dataset-version history. Optional exports may be added only
after online publication succeeds.

## Resource and contract inventory

| Dependency | Legacy evidence | Evidence | Online representation |
| --- | --- | --- | --- |
| Country/territory/ISO aliases | `resources/iso3/` consumers throughout per-source `02/03` steps | `confirmed by code`; alias/unknown cases `confirmed by fixture` | Existing versioned Country/territory resource. |
| ROP1/ROP2/ROP25/ROP3 hierarchy | `resources/rop/rop_pipeline.py`, pull scripts, `rop_aligned/align_rop_tables.py` | Pull/alignment `confirmed by code`; one hard-coded IMB backfill in alignment is `conflicting` | Existing versioned ROP resource; bounded missing-parent warnings only when approved. |
| Source registry/aliases | `resources/Database_Sources/` consumed by source mapping and AX identity | `confirmed by code` | Versioned source-alias resource. |
| Per-source field maps | `resources/{ax,etno,imb,jp,wcd}/...fields...` read by forming scripts | `confirmed by code` | Versioned code contracts initially; tabular imports only with reviewed activation. |
| Semantic type rules | `06_*_data_types.py` for each Tier 1 source and `08_engagement_partners_data_types.py` | `confirmed by code`; invalid cases `confirmed by fixture` | Versioned code contracts with deterministic checksum. |
| Add-on fields | `resources/Add-on_Fields_Agg_1/` consumed by AX field/type processing | `confirmed by code` | Versioned rule contract. |
| JP PeopleID3 and PEID | Tier 2 ROP derivation and mapping steps under `tier_2/03_processing/engagement_partners/` | `confirmed by code` | Versioned typed tabular resources. |
| Engagement template mapping | Tier 2 field and identifier steps | `confirmed by code` | Versioned typed resource or code contract. |
| AX ROP3/UUID ledgers | Fixed shared/Tier 1/Tier 2 snapshots under `resources/AX_UUID*` plus Tier 1/Tier 2 AX-code scripts | `confirmed by code`; mutable latest-file and flat-row import are rejected | One private transactional PGAC → PGIC → many-binding registry graph imported from a checksum manifest; unsafe aliases remain quarantined evidence and snapshots become read-only migration evidence only. |
| Tier 1 field priority | `resources/data_priority_agg_1/` and fallbacks in both Tier 1 merge scripts | `confirmed by code`; precedence fixture `confirmed by fixture` | Versioned priority resource pinned per merge. |
| Aggregate mappings/thresholds | `merge_workflows/*.py` and `aggregate_2/agg_2.py` | `confirmed by code` except Aggregate 2 naming | Versioned code/rule contracts pinned per candidate. |

The five retained tabular families beyond Country/ROP are imported as complete
immutable snapshots by `pnpm run pipeline-resources:import:local` or
`pnpm run pipeline-resources:import:remote`. Their built-in manifest fixes the
exact AX Data relative path, SHA-256 checksum, and retrieval timestamp. All five
files are validated before any candidate activates; sanitized fixture packages
are local/test bootstrap only, not production resource substitutes.

## Conflicts, superseded paths, and unused artifacts

- `aggregate_1/google_sheet_agg_1_push.py` is empty: `unused`.
- AX Data's `docs/pipeline_flow_index.md` describes several planned flow docs
  that do not exist: `documented only`.
- AX Data's static `docs/pipeline_map.md` still names legacy ETNO steps
  `08_etno_apply_ax_code.py` and `09_etno_update_uuid_ledger.py`, while the
  current ETNO directory ends at `06_etno_data_types.py` and the shared Tier 1
  AX-code runner owns identity: `conflicting`; the shared runner is canonical.
- Any “latest timestamp/mtime/Drive file” selector is `confirmed by code` as an
  old operational behavior but explicitly superseded by immutable online input
  bindings.
- The ROP alignment script's hard-coded historical IMB input is `conflicting`
  and must not be copied into AX Online.

See [decision-log.md](decision-log.md) for the binding resolutions and remaining
publication blockers.
