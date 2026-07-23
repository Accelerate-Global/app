## Why

AX Online can ingest IMB, Etnopedia, Joshua Project, and Google Sheets, but only IMB passes through a reproducible forming candidate before publication. Tier 1 identity and merge work cannot safely begin until Etnopedia, Joshua Project, WCD, and Accelerate-owned sources produce curated, versioned datasets through the same immutable review gate.

## What Changes

- Register Tier 1 forming engines for Etnopedia, Joshua Project, WCD, Accelerate-owned Sheets, and IMB.
- Add stable source-profile keys that identify code-managed sources and approved Google Sheet/tab flows independently of names, URLs, folders, or timestamps.
- Define checked-in versioned field/type contracts and deterministic stable row-key rules for every source.
- Resolve country and ROP values through exact pinned resources while preserving unresolved rows with structured findings.
- Make duplicate stable identities and duplicate complete `(PG_ROP3, Geo_ISO3)` keys blocking instead of advisory.
- Preserve raw and parsed ingestion artifacts, build/review/reject/rebuild/download candidates, and require explicit publication to stable source datasets.
- Keep source-specific UI inside the existing run-detail candidate surface.
- Non-goals: this change does not allocate AX codes, merge sources, or publish aggregates.

## Capabilities

### New Capabilities

- `tier1-source-forming`: Deterministic, source-specific forming contracts and publication for all five Tier 1 sources.
- `source-profile-connections`: Stable deployed or admin-bound source profiles that select forming behavior without relying on display metadata.

### Modified Capabilities

- `dataset-forming-platform`: The shared platform executes multiple registered engines and preserves source-specific validation summaries.
- `api-connection-runs`: Engine-managed imports archive snapshots without directly publishing raw rows.
- `pipeline-resource-bindings`: Tier 1 engines declare their exact Country/ROP, source-alias, field/type, and source-specific crosswalk dependencies.

## Impact

- Source engines and contracts under `src/lib/dataset-forming/engines/**` and `src/lib/dataset-forming/contracts/**`.
- Code-managed connection definitions plus Google Sheets source-profile binding.
- Additive private source-profile persistence and guarded admin binding APIs.
- Existing forming routes/run-detail UI; no new source-specific pages.
- Stable curated datasets and immutable candidate artifacts for AX, ETNO, IMB, JP, and WCD.
- Supabase private schema/RLS, Storage privacy, same-origin guards, and Vercel deployment model remain unchanged.
