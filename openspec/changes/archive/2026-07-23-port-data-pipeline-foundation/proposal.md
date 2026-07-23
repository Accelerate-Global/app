## Why

AX Online currently gives only IMB a reviewable forming candidate between immutable ingestion and explicit dataset publication. The remaining source flows cannot be ported safely until that IMB-specific lifecycle becomes a shared, versioned contract and every transform can pin the exact resource and rule versions that produced its output.

## What Changes

- Introduce a source-agnostic dataset-forming lifecycle for building, reviewing, rejecting, rebuilding, downloading, and publishing immutable candidates.
- Register source-specific forming engines behind one typed interface while preserving the current IMB output and decision behavior.
- Generalize forming-run lineage, validation, finding, artifact, and status data so it is not typed or described as IMB-only.
- Let each forming engine declare and pin its required reference-resource versions and code-contract checksums at build start.
- Add a durable pipeline-flow inventory and sanitized characterization fixtures for the legacy AX Data source, identity, merge, and aggregate rules that later changes will port.
- Extend candidate APIs and the connection run-detail UI to present the generic lifecycle without creating source-specific pages.
- Preserve administrator authorization, same-origin mutation protection, private Supabase storage, dataset version history, and the existing explicit publish gate.
- Treat this as an additive migration: existing IMB forming records and artifacts remain readable and publishable.
- Non-goals: this foundation does not yet assign AX identities, port non-IMB source transforms, merge sources, publish aggregate products, introduce an arbitrary workflow builder, or connect the runtime to the AX Data repository.

## Capabilities

### New Capabilities

- `dataset-forming-platform`: Shared candidate lifecycle, source-engine registration, generic lineage, validation findings, private artifacts, and explicit publication.
- `pipeline-contract-characterization`: Versioned inventory and sanitized golden fixtures describing the legacy rules that later source, identity, merge, and aggregate implementations must compare against.
- `pipeline-resource-bindings`: Per-engine declaration and immutable binding of required reference resources and code-contract checksums.

### Modified Capabilities

- `imb-dataset-forming`: IMB uses the shared forming platform while retaining its current field, country, ROP, validation, rebuild, rejection, and publication behavior.
- `api-connection-runs`: Successful import snapshots can advertise an eligible forming engine and expose generic candidate actions without publishing source rows.
- `versioned-reference-resources`: Valid resource sets can satisfy engine-specific required-resource declarations and report affected forming definitions.

## Impact

- Primary code: `src/lib/imb-forming/**`, new `src/lib/dataset-forming/**`, `src/lib/api-connections/**`, `src/lib/reference-resources/**`, `src/db/schema.ts`, forming API routes, and connection detail components.
- Database and storage: additive Supabase migration(s) for generic forming metadata and resource bindings; existing private schemas, RLS posture, and storage buckets remain authoritative.
- API contracts: current IMB endpoints remain compatible while their response model becomes generic enough for later sources.
- UI smoke: the existing run-detail sheet remains smoke-covered and gains generic candidate states; no new page is required.
- Data integrity: immutable source/resource/rule/output checksums and restrictive lineage references remain mandatory.
- Auth/admin: no role expansion; all build, reject, and publish mutations remain administrator-only and same-origin guarded.
- Vercel: no new service or recurring cost; implementation stays within the existing Next.js/Supabase deployment model.
