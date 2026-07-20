# Reference Resource Foundation Implementation Map

This record captures the verified pre-change baseline and the intended cutover
for OpenSpec change `add-versioned-reference-resource-foundation`. It is an
implementation aid; durable behavioral requirements remain in OpenSpec.

## Baseline Snapshot

Captured on July 17, 2026 from the checked-in generated resources before the
foundation implementation began.

| Resource | File bytes | File SHA-256 | Primary counts |
| --- | ---: | --- | --- |
| Country/ROG | 168,467 | `39fc5ec370c4bd497c4281efc1eb74020b0e04480e06e68edbaad6781de5d704` | 273 entries, 259 active, 249 official ISO |
| ROP | 22,526,522 | `40eb723945c679c6f490a66a24e88e0423ff7024b66b70e0da008f4f84594b7f` | 13,069 flattened entries, 17 ROP1, 292 ROP2, 9,015 ROP25, 13,065 ROP3, 21,418 geography rows |

Country/ROG has 145 entries with aliases and 336 generated aliases. Persisted
rows in `private.iso_country_code_entry_overrides` are an additional
environment-specific overlay that bootstrap must fold into the first persisted
version. ROP has 13,064 geography buckets and join-issue counts of 121
`missing-rop25`, 4 `parent-only-rop25`, and 1 `rop2-conflict`.

Representative parity records are Afghanistan, Lao, and Zimbabwe for
Country/ROG and `rop3-100425`, `rop3-113489`, and `rop3-113884` for ROP. Exact
parity tests must compare every stable key in addition to these readable probes.

Country search currently covers display/status, ISO, UNTERM, GENC, FIPS, ROG3,
classification, source URI, and aliases. Its CSV columns are Country/Territory,
Status, ISO3, ISO2, Numeric, official UN names/source, FIPS, ROG3, GENC3, GENC2,
GENC numeric, Classification, Alternative names, and Source URI.

ROP search currently covers all term codes/names/displays, status, row type,
join issue, place, language, source, ethnic ID, and geography fields. Its CSV
columns are ROP1, ROP2, ROP25, ROP3, Status, Row type, Join issue, Place,
Language, Source, and Ethnic ID.

## Cutover Map

| Current owner | Current behavior | Foundation owner | Required compatibility |
| --- | --- | --- | --- |
| `src/app/dashboard/resources/page.tsx` | Hard-coded two-card catalog | Persisted catalog repository | Same routes and direct cards; add active-version metadata and admin attention state |
| `src/lib/iso-country-codes.ts` | Fetch/build/validate plus generated-file and mutable-override reads | Country adapter plus persisted active-version repository | Preserve source rules, field meanings, null behavior, search/CSV content, and immediate alias visibility |
| `src/lib/rop-codes.ts` | Fetch/build/validate plus generated-file read | ROP adapter plus persisted active-version repository | Preserve hierarchy, parent-only rows, join issues, details, geography, and source thresholds |
| `src/app/api/iso-country-codes/refresh/route.ts` | Returns transient full resource | Candidate-build compatibility route | Keep POST/admin/same-origin contract; return persistent candidate metadata |
| `src/app/api/rop-codes/refresh/route.ts` | Returns transient full resource | Candidate-build compatibility route | Keep POST/admin/same-origin contract; return persistent candidate metadata |
| `src/app/api/iso-country-codes/alternative-names/route.ts` | Mutates private override row | Derive, validate, and activate immutable Country version | Keep authorization, duplicate rules, and later-read outcome |
| `src/components/dashboard/iso-country-codes-client.tsx` | Owns full resource, client filtering/CSV, session refresh | Paged active query plus streamed CSV and lifecycle controls | Keep detail fields and all current search/CSV semantics |
| `src/components/dashboard/rop-codes-client.tsx` | Receives 22.5 MB resource, client filtering/CSV, session refresh | Cursor-paged active query plus streamed CSV and lifecycle controls | Keep flattened rows, details, geography, search, and CSV semantics |
| `src/data/*.generated.json` | Runtime canonical data | Explicit bootstrap/recovery input | No silent runtime fallback after catalog initialization |
| `private.iso_country_code_entry_overrides` | Former mutable alias overlay | Versioned alias content | Runtime writes are removed; bootstrap performs the one-way fold. Physical removal follows deployed parity so a fresh migration cannot delete production aliases before reconciliation. |

Same-stem tests for each listed loader, route, page, and client move with the
production behavior. Database invariants receive pgTAP coverage, new lifecycle
surfaces receive literal smoke markers, and the route-guard/security sweeps
remain centralized.

## Implementation Boundaries

- Shared lifecycle owns catalog, immutable packages, artifacts, validation,
  diff, activation, rollback, audit, resource sets, queries, and health.
- Typed adapters own family-specific source parsing, validation, projections,
  DTOs, search fields, CSV columns, and risk-aware diffs.
- Browser code never receives database credentials, service-role keys, or
  direct private artifact access.
- This change stops before pipeline runs, external identifier crosswalks, AX
  identifier allocation, forming, merging, aggregation, and scheduling.
