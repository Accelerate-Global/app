## 1. Planning and Contracts

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope 'src/components/chat/private-data-chat-client.tsx' --scope 'src/components/chat/private-data-chat-client.test.tsx' --scope 'tests/ui/10-journeys.spec.ts' --scope 'openspec/changes/simplify-private-data-chat-output/**'` and record the required verification lane.
- [x] 1.2 Validate the OpenSpec proposal, design, and private-data-chat delta specification strictly.

## 2. Chat Presentation

- [x] 2.1 Remove transcript provenance rendering and client transcript-state storage while preserving the streamed API event contract.
- [x] 2.2 Remove the visible `Ask about approved data` statement and give the textarea the accessible name `Question for Qwen`.

## 3. Regression Coverage

- [x] 3.1 Update the chat component test to verify answers and facts remain visible while provenance details and the removed prompt statement do not render.
- [x] 3.2 Update the existing private-data-chat browser smoke journey to verify the simplified output and accessible composer.

## 4. Verification

- [x] 4.1 Run the direct component test and `pnpm run smoke:check`.
- [x] 4.2 Run every command required by `pnpm run verify:change`, ending with `pnpm run verify:change:run` on the final tracked tree.
- [x] 4.3 Verify implementation completeness, correctness, and coherence against the OpenSpec artifacts, then synchronize the delta specification to the main specification.
