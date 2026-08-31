## Context

The existing chat client stores provenance from each `PrivateDataChatTurnMessage` and renders it as an expandable block beneath the assistant's answer. The composer also presents a visible label above a textarea. The API, semantic planner, deterministic compiler, read-only query broker, and answer generator already produce and consume provenance independently of that presentation.

This is a narrow UI change on the existing administrator canary. It does not require Supabase, RLS, auth metadata, Qwen gateway, Cloudflare, or Vercel runtime changes. The existing route remains registered in UI smoke coverage.

## Goals / Non-Goals

**Goals:**

- Keep assistant cards focused on answer content and facts by omitting the provenance disclosure.
- Remove the visible composer label requested by the user without weakening accessible textarea naming.
- Preserve the chat event/API contract and all server-side grounding and provenance behavior.
- Prove the absence of both visible strings in component and browser-smoke tests.

**Non-Goals:**

- Changing which data Qwen can discuss or access.
- Removing provenance from server results, event types, logs, or diagnostic/audit paths.
- Changing prompt, catalog, SQL, database role, auth, canary, or feature-flag behavior.
- Redesigning the broader chat page.

## Decisions

1. **Remove provenance only at the rendering boundary.** The client will continue accepting the existing stream message shape, while the transcript view will not store or render its provenance. This avoids an API-breaking change and preserves trusted operational evidence. Removing provenance throughout the pipeline was rejected because it would weaken auditability without being necessary to satisfy the presentation request.
2. **Use a screen-reader-only label with new wording.** The visible `Ask about approved data` text will be removed, and the textarea will be named `Question for Qwen` through an associated `sr-only` label. An unlabeled textarea or placeholder-only name was rejected because placeholder text is not an adequate durable accessible label.
3. **Assert absence as well as continued function.** Component coverage will provide a response containing provenance and verify that provenance details are absent while the answer/facts remain. Browser smoke will likewise assert that neither removed visual appears after a synthetic answer, while preserving the existing successful-chat assertion.

## Risks / Trade-offs

- **[Risk] Users lose self-service visibility into query identifiers and catalog revisions.** → Retain provenance in the server/event contract and operational evidence so support and diagnostics remain possible outside the conversation card.
- **[Risk] Removing the visible label could make the composer purpose less obvious.** → Keep the existing example placeholder, nearby chat framing, and a programmatic `Question for Qwen` label.
- **[Risk] A future refactor could accidentally restore the removed chrome.** → Add direct negative assertions in both component and end-to-end smoke coverage.

## Migration Plan

Deploy as a backwards-compatible presentation update. No data migration, provider configuration, or local Supabase service is required. Rollback is the prior frontend deployment or commit; the unchanged API payload remains compatible in either direction.

## Open Questions

None.
