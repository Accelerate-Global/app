<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI Smoke Contract

Treat the UI smoke system as mandatory repo policy.

- Every `src/app/**/page.tsx` needs an explicit entry in `/Users/blake/Documents/accelerate-global/online/tests/ui/route-registry.ts`.
- Rendered pages must expose a literal `data-smoke-page="..."` marker.
- New sheets, dialogs, menus, tooltips, and popovers that should be browser-smoked must expose matching literal `data-smoke-trigger`, `data-smoke-surface`, and `data-smoke-ready` attributes.
- Every new `src/components/ui/*.tsx` shared primitive needs a colocated `*.smoke.tsx` fixture.
- Run `pnpm run smoke:check` after UI changes. It regenerates the shared fixture manifest and fails on missing coverage.

Full rules and examples live in [/Users/blake/Documents/accelerate-global/online/docs/testing/ui-smoke.md](/Users/blake/Documents/accelerate-global/online/docs/testing/ui-smoke.md).
