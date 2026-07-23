# Sanitized pipeline characterization fixtures

These files contain invented people, identifiers, and values. They are not
copied production rows. The corpus is deliberately small and covers the legacy
behaviors that must be frozen before additional AX Data flows are ported:

- a normal source row;
- a missing stable identifier;
- a country alias and an unknown country;
- present and absent ROP3, including the WCD fallback field;
- duplicate domain keys;
- invalid numeric and boolean values;
- a renamed/missing required field (schema drift);
- deterministic ROP3 identity, UUID ledger reuse, UUID minting, and identity
  conflicts;
- field-level cross-source precedence and missing-priority fallback;
- Aggregate 1 weighted values, country selection, source flags, and workers;
- self-engaged/watchlist threshold branches; and
- Tier 2 duplicate canonical-code conflicts.

`expected-output.json` is the reviewed golden result. Run
`pnpm pipeline:characterize` to recompute the result from the four input files
and compare it byte-for-byte after canonical JSON serialization. The command
does not accept external fixture paths and contains no provider, Drive,
Supabase, or AX Data access.
