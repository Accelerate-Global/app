## Context

Private data chat currently performs semantic retrieval before Qwen planning. The retrieval gate recognizes approved field/metric vocabulary but not the ordinary phrase “how many people,” so both India and South Asia fail as low-confidence before model inference. The planner also treats macro regions as categorically unavailable even though `filter_regions` and `filter_region_countries` already drive the authoritative dataset UI and their checksum is recorded in the active semantic snapshot.

The fix crosses retrieval, deterministic planning, value resolution, evaluation, and orchestration. It does not require a database migration, prompt change, Samson change, or new external service.

## Goals / Non-Goals

**Goals:**

- Interpret “how many people” as summed recorded population and keep “how many people groups” as record count.
- Support exact configured filter-region names and reviewed compatibility aliases as filter scope.
- Keep region membership out of Qwen authority: application code resolves and applies the country set.
- Bind the resolver to the filter-region checksum already recorded by the active semantic snapshot.
- Preserve unknown-geography, ambiguity, injection, authorization, result-size, and off-topic safeguards.

**Non-Goals:**

- Adding region as a grouping dimension.
- Supporting arbitrary continents or model world knowledge.
- Changing region definitions, UUPG, ROP relationships, auth, RLS, or the production audience.
- Solving general Qwen latency; that work is isolated in a separate task.

## Decisions

### Resolve filter regions before planning

Application code will load the existing ordered region/country registry, reproduce its canonical checksum, and compare it with `sourceVersionManifest.filterRegions` from the active semantic snapshot. Exact normalized region names and reviewed compatibility aliases produce a trusted resolver view; stale, empty, or ambiguous definitions fail closed.

Alternative rejected: ask Qwen to infer South Asian countries. That would make membership nondeterministic and dependent on model world knowledge.

### Use a deterministic typed fast path

For the exact grammar “how many people/people groups in [geography],” the resolver owns the complete scalar intent and constructs the existing catalog-version-bound query without a model call. One country remains `eq`; multiple region countries become bounded `in`; `Global` produces no country predicate. The query then follows the ordinary country-resource normalization, parameterized compiler, authorization-preserving broker, evidence ledger, and turn-state path. The final scalar response uses the existing deterministic evidence renderer instead of a second model call.

Alternative rejected: add a physical `region` column or join. The dataset already defines regions as reviewed country sets, so a new storage/query relationship would duplicate authority.

Alternative rejected: prompt Qwen to emit or copy the region scope. The intent and scope are exact enough for deterministic planning, and bypassing two model calls is both safer and materially faster.

### Pass only bounded trusted resolver context to Qwen

Retrieval will accept a server-verified resolver view that pins `field.country` plus the exact approved metric and identifies the canonical geography label. The validated retrieval lineage accompanies the broker audit, but neither Qwen nor the browser receives region membership or database identifiers.

### Make natural population intent explicit

The deterministic grammar maps “how many people” to `total_population`, while phrases that explicitly say “people groups” map to `people_group_count`. This distinction is covered by paired unit, end-to-end, and production cases. Questions outside the exact grammar continue through the existing retrieval/Qwen path unchanged.

## Risks / Trade-offs

- **Region registry changes after snapshot activation** → checksum mismatch returns a bounded semantic-context failure until a new snapshot is reviewed and activated.
- **A phrase contains both a region and a separate country** → refuse or clarify unless one unambiguous supported scope can be proven; never silently union or intersect.
- **Large region expansion** → enforce the existing 50-country plan bound; `Global` is represented by no country predicate.
- **Fast-path matching becomes too broad** → require an anchored scalar grammar and an exact full geography candidate; partial or instruction-shaped tails do not resolve.
- **Unrelated planning regresses** → run the complete deterministic and pinned live-Qwen compatibility suites even though the gateway contract is unchanged.

## Migration Plan

1. Add deterministic region-source/checksum, resolver-view, scope-application, prompt, and evaluation changes with direct tests.
2. Run repository and local database/UI gates without changing production data.
3. Run the unchanged pinned model compatibility evaluation plus exact fast-path unit/end-to-end cases.
4. Deploy the application, execute Blake-only India/South-Asia/negative canaries, and verify logs and runtime health.
5. Roll back through the previous Vercel deployment if any gate fails; Samson remains untouched.

## Open Questions

None. Region grouping and arbitrary geographic ontologies remain explicitly deferred.
