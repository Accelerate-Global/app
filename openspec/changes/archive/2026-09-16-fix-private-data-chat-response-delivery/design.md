## Context

The production `/api/chat` request completed its private Qwen planner call in 40.8 seconds and recorded a successful analytical query after 49 seconds, yet the browser did not display the answer until roughly the 300-second Vercel function boundary. The deployed code at commit `91aa8e1b3644e254a4469a6b2021ef82665881c0` launches `orchestratePrivateDataChatTurn` as a detached promise from a manually managed `ReadableStream.start()` callback. The endpoint does not stream generated tokens; it emits short status events followed by one deterministic final message.

The route must remain on the Node.js runtime because it uses Node crypto and database/provider clients. Existing auth, same-origin protection, canary checks, Qwen application timeout, query limits, redacted audit behavior, and private no-store headers remain authoritative.

## Goals / Non-Goals

**Goals:**

- Bind the HTTP response lifecycle directly to completion of chat orchestration.
- Deliver a completed bounded message or normalized orchestration error immediately after server work settles.
- Preserve cancellation, pilot authorization, safe error text, signed turn state, resource results, and deterministic answers.
- Make the 300-second Vercel duration assumption explicit and regression-tested.

**Non-Goals:**

- Stream model tokens or retain server-originated stage events.
- Change planner, semantic retrieval, compiler, broker, database, gateway, or Cloudflare behavior.
- Change authentication, workspace-role metadata, canary scope, RLS, persistence, or audit contents.

## Decisions

### 1. Return one awaited discriminated JSON result

The route will await `orchestratePrivateDataChatTurn` before constructing the success response. Admitted requests return one of:

- `{ type: "message", message: PrivateDataChatTurnMessage }`
- `{ type: "error", code, message, retryable }`

Pre-orchestration authentication, authorization, configuration, size, and payload failures keep their existing HTTP status and `{ error: string }` shape. Orchestration errors retain their existing normalized logical error contract and successful HTTP transport status, minimizing scope while removing SSE framing and the terminal `done` event.

**Alternative considered:** keep SSE and change `start` to `async start`. That would match Vercel's documented stream pattern, but this endpoint has no token stream and gains only brief post-planner stage labels. Removing the unnecessary transport is smaller operationally and eliminates manual controller/framing failure modes.

### 2. Keep immediate progress local to the client

The client will show `Interpreting your question` as soon as a request starts and clear it when the JSON result settles. The existing `AbortController` remains the cancellation boundary. Server-side interpreting/validating/querying/explaining callbacks may remain available to orchestrator tests and diagnostics, but they are not part of the browser transport.

### 3. Declare the hosting deadline in route code

`/api/chat` will export `maxDuration = 300`. The Qwen application timeout remains 210 seconds and database statements remain separately bounded, preserving margin for retrieval, validation, query execution, audit insertion, JSON serialization, and normalized failure delivery.

### 4. Add contract and end-to-end regression coverage

Route tests will assert JSON content type, discriminated message/error payloads, private cache headers, and the explicit duration. Client tests will consume JSON and verify answer, normalized error, signed context/continuation, and cancellation behavior. The existing authenticated private-chat smoke journey remains the browser-level proof that a submitted turn leaves the running state and renders the fake-Qwen answer.

## Risks / Trade-offs

- **[Risk] Loss of validating/querying/explaining labels** → The long planner phase already dominates latency and the client retains an immediate interpreting state; the observed post-planner work was about six seconds.
- **[Risk] A future token-streaming requirement would need another contract change** → Introduce a reviewed streaming transport only when the model actually produces incremental user-visible output.
- **[Risk] A 210-second model call approaches the hosting limit** → Keep the explicit 300-second function duration and existing downstream deadlines; tests verify the declaration but do not weaken any provider timeout.
- **[Risk] Client and route could disagree on the discriminant** → Define the response union in shared private-data-chat types and cover both branches in direct tests.

## Migration Plan

1. Change the route and shared response type together.
2. Change the only browser consumer and its tests in the same commit.
3. Run direct route/client tests, UI smoke contract checks, targeted authenticated chat smoke as required by the impact planner, and the terminal change gate.
4. Deploy normally; no database, environment, Cloudflare, or Supabase migration is required.

Rollback is a code-only redeploy of the prior route/client pair. Mixed versions are avoided because both ship in one Next.js deployment.

## Open Questions

None. Production timing evidence and the current single-message response contract are sufficient to select awaited JSON.
