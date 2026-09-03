## Why

The guarded latency canary found that richer supported questions were being confused with geographies embedded in ordinary analytical language. `to` and `and` overlapped the exact short country codes `TO` and `AND`, while `Global Engagement Anywhere` overlapped the reviewed `Global` filter region. The geography fast path therefore returned a false multi-geography clarification before semantic retrieval or Qwen planning.

## What Changes

- Keep two- and three-character approved country codes valid for exact geography requests.
- Exclude those short codes from contained-phrase ambiguity detection inside longer analytical prose.
- Require contained aliases to cover the whole candidate, apart from geography connectors, before declaring multiple geographies.
- Route richer country questions back through the existing reviewed retrieval, planner, compiler, and broker path without broadening query authority.

## Capabilities

### Modified Capabilities

- `private-data-chat`: exact scalar geography remains deterministic while richer supported analytical questions are not intercepted by coincidental short codes.

## Impact

- Code and tests: `src/lib/private-data-chat/geography-resolver.ts` and `src/lib/private-data-chat/geography-resolver.test.ts`.
- No prompt, model, retrieval policy, compiler, database, auth, or network changes.
