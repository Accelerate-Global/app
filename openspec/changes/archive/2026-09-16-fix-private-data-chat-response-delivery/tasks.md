## 1. Response Contract

- [x] 1.1 Replace the detached SSE route lifecycle with an awaited discriminated JSON response and declare the 300-second function duration.
- [x] 1.2 Update the private data chat client to consume the JSON message/error result while preserving local progress, cancellation, signed context, continuation, and safe failure behavior.

## 2. Regression Coverage

- [x] 2.1 Update direct route tests for JSON success/error payloads, private no-store headers, and the explicit duration.
- [x] 2.2 Update client tests for JSON completion, normalized failures, context/continuation flows, and cancellation.
- [x] 2.3 Confirm the existing authenticated private-chat smoke journey covers prompt completion without new smoke markers.

## 3. Verification

- [x] 3.1 Run `pnpm run spec:validate` and the direct route/client tests.
- [x] 3.2 Rerun `pnpm run verify:change`, complete every listed required command and targeted smoke subset, and finish with `pnpm run verify:change:run`.
