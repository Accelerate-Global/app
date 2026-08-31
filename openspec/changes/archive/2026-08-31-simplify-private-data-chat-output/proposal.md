## Why

The private Qwen transcript currently exposes internal provenance details after every grounded answer and adds a redundant visible prompt label. Removing that interface chrome keeps the pilot conversation focused on the answer while retaining provenance in the trusted server response for audit and diagnostics.

## What Changes

- Stop rendering the expandable **Data provenance** section beneath assistant answers.
- Remove the visible **Ask about approved data** prompt label while keeping the textarea accessible under a concise replacement name.
- Keep provenance generation, transport, grounding, and server-side safety boundaries unchanged.
- Update component and browser-smoke coverage to assert the simplified transcript and prompt presentation.
- **Non-goals:** no changes to authentication, canary access, admin permissions, database access, SQL compilation, Supabase, Qwen prompting, the chat API response contract, or Vercel topology.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `private-data-chat`: Change the user-visible presentation contract so provenance remains available to trusted application code but is not displayed in transcript outputs, and the prompt remains accessible without the removed visible label.

## Impact

- UI: `src/components/chat/private-data-chat-client.tsx`
- Component coverage: `src/components/chat/private-data-chat-client.test.tsx`
- Browser coverage: `tests/ui/10-journeys.spec.ts`
- Specification: `openspec/specs/private-data-chat/spec.md` after delta synchronization
- API contracts and generated event payloads remain unchanged; provenance stays present in `PrivateDataChatTurnMessage`.
- UI smoke coverage changes only in assertions for the existing `/dashboard/chat` route; no route-registry or smoke marker changes are required.
