## Context

The geography resolver accepts exact approved country names and codes, then scans a longer candidate for multiple contained geographies so mixed requests can clarify safely. That second scan treated every two- and three-character country code as ordinary prose and did not check whether matched geographies covered the whole candidate. In the production regressions, `equal to true` matched Tonga's `TO` code, while `true and Global Engagement Anywhere` overlapped Andorra's `AND` code and the `Global` filter region alongside Sudan.

## Decision

Require at least four normalized characters for contained-phrase matching, and declare contained ambiguity only when matched aliases cover the candidate after removing `and`/`or` connectors. Preserve exact lookup before those filters, so direct requests for `TO`, `AND`, `Global`, or another approved alias still resolve deterministically. If a longer analytical question contains one country name plus extra predicates, the fast path returns `none` and the established reviewed planner path retains every requested condition.

## Risk

A mixed-geography request using only a short code inside a longer phrase will fall back to the planner instead of receiving deterministic ambiguity handling. That is safer than treating common prose words as geographic authority or dropping additional analytical predicates.
