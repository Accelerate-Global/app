## Why

The IMB forming job currently fails after completing transformation because the production artifact bucket accepts JSON but rejects the generated `text/csv` artifact. The run-detail drawer also constrains the candidate metadata and logs to a narrow column, causing identifiers to overlap and making the failure difficult to inspect.

## What Changes

- Permit private IMB forming CSV artifacts in the existing API-connection artifact bucket while retaining the bucket's private access and bounded file-size policy.
- Preserve all-or-nothing artifact cleanup and make a failed provider upload diagnosable through normalized server logging without exposing credentials or raw provider objects.
- Make the run-detail drawer occupy half of the desktop viewport, while retaining a full-width drawer on narrow screens.
- Make candidate identifiers and checksums wrap or truncate within their own cells instead of overlapping adjacent content.
- Add regression coverage for the bucket contract, forming artifact upload failure diagnostics, and drawer layout.
- Non-goals: automatically publish formed candidates, change the two active reference resources, change forming rules, expose Storage directly to browsers, or change admin permissions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `imb-dataset-forming`: Complete forming runs must be able to persist their private CSV artifact, and provider failures must remain safely diagnosable.
- `api-connection-runs`: The run-detail surface must provide a usable half-viewport desktop inspection area without content overlap.

## Impact

- UI: `src/components/dashboard/api-connection-detail-client.tsx` and its direct component test.
- Forming storage: `src/lib/imb-forming/storage.ts` plus focused tests.
- Supabase: a new migration updates the existing private `api-connection-artifacts` bucket MIME and size policy; database security tests verify the contract. No RLS, auth metadata, or admin permission changes.
- Vercel: no deployment configuration or API contract change; production deployment is required for the fix to take effect.
- UI smoke: existing API connection detail and run-diagnostics coverage remains the browser contract; no new route or smoke surface is introduced.
