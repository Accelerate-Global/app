## Why

Production private data chat completes Qwen planning and the approved analytical query in under one minute, but the browser can remain on “Interpreting your question” until the Vercel function-duration boundary. The current `/api/chat` route detaches orchestration from a manually managed SSE stream even though the endpoint returns one final deterministic answer rather than model-token output.

## What Changes

- **BREAKING** Replace the internal same-origin `/api/chat` SSE response with one awaited private JSON response containing either the completed bounded chat message or a normalized error.
- Keep cancellation and the existing local interpreting state while removing server stage events that do not represent token streaming.
- Declare the route's 300-second Vercel duration explicitly so the application deadline remains visible and reviewable.
- Add route, client, and browser regression coverage proving a completed orchestration is delivered promptly without waiting for the hosting-function boundary.
- Preserve Qwen, Cloudflare, semantic retrieval, deterministic compilation/querying, audit, auth, canary, and data-safety behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `private-data-chat`: Require completed chat turns and normalized failures to reach the browser promptly through an awaited bounded response while preserving cancellation and safe progress feedback.

## Impact

- API contract: [`src/app/api/chat/route.ts`](../../../src/app/api/chat/route.ts) changes from `text/event-stream` to private non-cacheable JSON for the internal chat POST.
- Client: [`src/components/chat/private-data-chat-client.tsx`](../../../src/components/chat/private-data-chat-client.tsx) consumes the bounded JSON result instead of manually reading SSE frames.
- Verification: direct route/client tests and the existing authenticated chat smoke journey cover completion and cancellation; no new page or smoke marker is required.
- Vercel: the route declares `maxDuration = 300`; no deployment setting, runtime, provider, or environment-variable change is required.
- Auth and admin permissions: unchanged.
- Data integrity and Supabase behavior: unchanged; analytical execution, audit evidence, credentials, RLS, and query limits remain intact.
- UI smoke coverage: the existing `/dashboard/chat` registration and markers remain authoritative.

### Non-goals

- Stream Qwen tokens or introduce a new realtime transport.
- Change the Qwen model, prompts, gateway, timeout, Cloudflare resources, semantic catalog, compiler, database schema, or deterministic answer rendering.
- Broaden pilot access, persist conversations, or expose provider details.
