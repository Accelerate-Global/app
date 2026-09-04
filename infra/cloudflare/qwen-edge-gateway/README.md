# Private Qwen edge gateway

This Worker is the public server-to-server edge for the private Qwen gateway.
Cloudflare Access authenticates the Vercel backend before the Worker runs. The
Worker then uses one least-privilege Workers VPC Service binding to reach only
the Samson gateway at `10.77.0.30:8443` through the dedicated Cloudflare
Tunnel. It never receives a database credential or the application HMAC key.

The Worker accepts only:

- `GET /health`
- `POST /v1/private-data-chat/plan`
- `POST /v1/private-data-chat/answer`

It forwards only the content and `X-AG-*` request-signing headers required by
the Samson gateway. Cloudflare Access credentials, cookies, and arbitrary
headers are never forwarded. Responses are read only after a declared 128 KB
bound is accepted, use an allowlisted header set, and return with
`Cache-Control: no-store`.

## Provider resources

The following resources were provisioned on 2026-08-28 in the selected personal
account (`06281b845d00a5b3857bf215dec00782`) while the
application feature remained disabled:

1. Zero Trust Free plan, Workers subdomain `blake-062.workers.dev`, and Zero
   Trust team `little-feather-aed2`.
2. Remotely managed Tunnel `accelerate-qwen-samson`
   (`3587b7cf-e928-4f57-9e98-d6e74547c0b6`), with its token installed only in
   Samson LXC 105 and a healthy connector.
3. HTTP VPC Service `accelerate-qwen-gateway`
   (`01a04934-2091-7de1-9f7c-6c686698cbd8`) on that tunnel with IPv4
   `10.77.0.30`, HTTPS port `8443`, no HTTP port, and certificate verification
   mode `verify_full`.
4. Worker `accelerate-qwen-edge-gateway` at
   `https://accelerate-qwen-edge-gateway.blake-062.workers.dev`, bound only to
   that VPC Service.
5. An all-traffic Cloudflare Access Service Auth policy containing only the
   replacement `Vercel Accelerate Private Qwen` service token.
6. Sensitive Vercel Production variables for the Worker URL and Access token;
   `PRIVATE_DATA_CHAT_ENABLED=false` remained in force during provisioning.

## Strict private-origin TLS

Samson presents a two-year RSA Cloudflare Origin CA certificate whose only SAN
is `samson.risencode.org`. The Worker uses that hostname as its private origin
URL, which supplies both HTTP `Host` and TLS SNI; the VPC Service binding still
supplies the only network route, `10.77.0.30:8443` through the dedicated
Tunnel. No public DNS record or public Tunnel hostname exists for
`samson.risencode.org`.

The Origin CA certificate belongs to the `risencode.org` zone in WMTEK account
`d6457eba65c9b6d71c9acd60b4b58bb7` (zone
`62b087073e97e002efa86aa93f3d8930`). The Worker, Access application, Tunnel,
and VPC Service remain in personal account
`06281b845d00a5b3857bf215dec00782`. Cross-account resource ownership does not
change the CA and hostname checks, and the live Worker/VPC path must be tested
after every certificate rotation.

The live certificate expires at `2028-08-28 21:57 UTC`. Cloudflare Origin CA
does not send expiry notifications, so the RisenCode infrastructure operator
must begin renewal no later than `2028-07-29`. Generate the replacement key and
CSR on Samson; validate SAN, dates, chain, hostname, and key match; install and
restart the gateway; then recheck the Worker health path while the VPC Service
remains on `verify_full`. The private key stays root-only on Samson and never
enters this repository, Vercel, Cloudflare Worker variables, or logs.

## Local verification

```sh
pnpm run cloudflare:qwen:types
pnpm run cloudflare:qwen:test
pnpm run cloudflare:qwen:dry-run
pnpm exec wrangler vpc service get 01a04934-2091-7de1-9f7c-6c686698cbd8
```

The provider check must report `Cert Verification Mode: verify_full`. A local
diagnostic may trust Cloudflare's published Origin CA RSA root explicitly, but
general browsers are expected not to trust an Origin CA certificate.

Cutover acceptance on 2026-08-29 kept the write-only Production Access token
inside Vercel. The production Worker returned `403` without Access credentials;
a randomized, health-only disposable Worker bound to the same VPC Service
returned `200` through `verify_full`; and the probe was then deleted and
confirmed absent. Repeat that layered method for TLS-only maintenance unless a
normal canary request already provides end-to-end evidence.

No provider secret belongs in this directory, Wrangler configuration, source,
test fixtures, or logs.
