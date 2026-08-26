## Why

The map MVP currently has focused component coverage and a three-row browser journey, but that does not exercise production-shaped row volume, the full filter set, responsive behavior, representative country aliases, or role access together. A deterministic local pre-production suite is needed before release so these checks are repeatable without production credentials, production data, or paid map services.

## What Changes

- Add a disposable 1,500-row map pre-production dataset generated from the repository-owned ISO country catalog with deterministic people-group, watchlist, UUPG, hotspot, and unmapped-geography cases.
- Extend browser coverage to verify table/map count parity across representative filters, local country and people-group search, empty and unmapped states, keyboard interaction, mobile/dark rendering, role access, provider-free network behavior, and a generous local responsiveness budget.
- Add focused fixture and component tests for deterministic volume, representative aliases, unmapped records, and mapped/unmapped count observability.
- Route future dataset-map changes through the expanded smoke journeys.
- Keep production data access, deployment, external map providers, and subjective geopolitical boundary approval out of scope.

## Capabilities

### New Capabilities

- `dataset-map-preproduction-verification`: Defines the local, production-shaped dataset fixture and automated release-readiness checks for the dataset map.

### Modified Capabilities

- None.

## Impact

- Test fixture generation: `scripts/lib/dataset-map-preproduction-fixture.ts`, `scripts/smoke-bootstrap.ts`, and `tests/ui/support/smoke-data.ts`.
- Browser verification: `tests/ui/10-journeys.spec.ts`, `tests/ui/route-registry.ts`, and `config/change-impact.manifest.json`.
- Map test observability: `src/components/dashboard/dataset-map-view.tsx` and its same-stem test.
- UI smoke coverage expands and therefore requires the full local smoke suite. Local Supabase is used only as disposable test infrastructure; no migration, API contract, auth policy, admin permission, data-integrity rule, Vercel behavior, or production environment changes are introduced.
