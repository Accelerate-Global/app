# API connection governance

API connections import external data into protected run artifacts. Passing the
runtime URL checks is necessary but is not approval to connect a new provider.

## Approved provider boundary

The supported provider set is:

- the code-managed IMB ArcGIS layer at `services2.arcgis.com`;
- the code-managed Etnopedia MediaWiki export at `en.etnopedia.org`;
- the code-managed Joshua Project people-groups endpoint at
  `api.joshuaproject.net`, using the provider key stored as a server-side secret;
- private Google Sheets explicitly shared read-only with the application service
  account and connected through the admin Google Sheets onboarding flow.

Generic HTTP connection creation and mutation are disabled in the API. A new
host, path family, provider credential, write method, or data-use purpose
requires a repo-reviewed OpenSpec change and code-managed definition or adapter
before production use.

## Approval checklist

The data/product owner and a technical `super_admin` jointly approve a new or
materially changed provider. Record the decision privately and verify:

1. source ownership, permitted use, redistribution limits, retention, and
   deletion obligations;
2. exact HTTPS host/path, method, response format, maximum expected size,
   schedule, and accountable owner;
3. the minimum fields required and whether any personal, confidential, licensed,
   or regulated data is present;
4. least-privilege credentials, storage in the provider-backed secret vault,
   rotation/revocation procedure, and prohibition on secrets in URLs or ordinary
   headers;
5. deterministic parsing, immutable checksummed output, downstream review and
   publication gates, and rollback behavior;
6. provider terms, rate limits, failure notifications, and a safe non-mutating
   acceptance run.

## Technical invariants

- URLs must use HTTPS, contain no embedded credentials, resolve only to public
  unicast addresses, and remain safe after every bounded redirect. DNS is pinned
  for the request to prevent rebinding to a blocked network.
- Responses are time- and size-bounded. Logs and previews redact configured
  secrets, and raw credentials never become dataset fields or published
  artifacts.
- Provider adapters own fetch and parse behavior. The run orchestrator owns
  durable state, logs, artifacts, resources, and publication boundaries.
- Google Sheets stay private and grant the app service account Viewer access
  only. A separate connection represents each selected tab.
- Production execution starts with one explicit run and review. Scheduling or
  publication is a separate approval, not a side effect of connecting.

## Change, rotation, and retirement

For an endpoint or schema change, update its adapter/definition, sanitized
fixtures, parsing tests, and data-pipeline documentation together. Run the
normal change gate before a production canary. Rotate secrets in the provider
vault and upstream provider without logging either value. To retire a source,
disable future runs/schedules, preserve required immutable evidence, revoke its
credential, and archive the connection only after downstream dependencies are
accounted for.
