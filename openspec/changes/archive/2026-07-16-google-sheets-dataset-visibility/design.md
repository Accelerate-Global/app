## Context

The Google Sheets setup UI creates one API connection per selected tab. Each connection retains its import metadata in `private.api_connections.provider_config`, and the first successful run creates the corresponding dataset through `createDataset`. The form and connect endpoint currently carry classification but not dataset visibility, so the database default makes every first-import dataset workspace-visible.

The existing dataset visibility model uses `datasets.is_workspace_visible`; changing that value is already coupled to a red system-managed `Private` tag by a database trigger. The source Sheet's sharing instructions are separate: they control whether the service account can read the Sheet, not whether non-admin workspace users can see the imported dataset.

## Goals / Non-Goals

**Goals:**

- Make initial imported-dataset visibility an explicit, understandable choice during Google Sheets setup.
- Use one choice for all selected tabs, defaulting to the current workspace-visible behavior.
- Carry the choice through the connect endpoint and persisted connection configuration to first-import dataset creation.
- Preview the existing `Private` tag when private is selected.
- Preserve compatibility with legacy connections and existing datasets.
- Cover the flow with component, route, domain, and browser-smoke verification.

**Non-Goals:**

- Modifying the source Sheet's sharing configuration.
- Supporting a separate visibility value for each selected tab.
- Reconfiguring an existing connection's initial visibility after connection creation.
- Overwriting visibility on refresh after the dataset exists.
- Changing administrator authorization, RLS, database schema, or deployment configuration.

## Decisions

### Use a positive workspace-visible control with a visible private state

The form will use the same positive framing as dataset settings: enabled means visible to non-admin users, disabled means private. It defaults to enabled for backward compatibility. When disabled, the form shows the existing red `Private` tag and explains that every selected tab will create a private dataset.

This is clearer than a generic “private” checkbox because it matches the existing dataset-setting vocabulary and makes the enabled state unambiguous. A single control is used because the current flow batches selected tabs into parallel connections and offers one shared classification.

### Persist the initial choice in each connection's JSONB provider configuration

The connect request will include `isWorkspaceVisible`. Every generated Google Sheets provider configuration will store the boolean. The provider configuration type will make the field optional so legacy records remain readable; missing values resolve to `true`.

No SQL migration is needed because `provider_config` is JSONB and the dataset table already contains the visibility column. Storing the choice on the connection ensures queued or retried first imports retain the administrator's intent without introducing transient server state.

### Apply visibility only on first dataset creation

The import persistence branch that creates a dataset will pass `providerConfig.isWorkspaceVisible ?? true` into `createDataset`. The replacement branch will remain unchanged, so an administrator's later visibility edits are not silently undone on refresh.

`createDataset` will accept an optional initial visibility value and default it to `true`, preserving all existing callers. Creating with `false` lets the existing database trigger apply the red system-managed `Private` tag atomically.

### Keep the connect API backward-compatible

The route schema will default an omitted `isWorkspaceVisible` field to `true`. Current UI requests will always send the explicit boolean, while older clients and direct integrations keep the previous visible behavior.

### Verify the complete data path

Component tests will exercise the control, private preview, and request payload. Route tests will cover explicit private and omitted/default-visible inputs. Domain tests will cover persisted provider configuration and first-import fallback behavior. The existing Google Sheets browser-smoke journey will assert the new control and private preview. The repo change-impact and terminal verification gates remain authoritative.

## Risks / Trade-offs

- [Users confuse imported dataset privacy with source Sheet privacy] → Use copy that explicitly distinguishes visibility to workspace non-admin users from Sheet sharing required for service-account access.
- [Legacy records lack the new field] → Treat missing configuration as workspace-visible at every read boundary.
- [Refresh reverts an administrator's later dataset setting] → Read the saved initial choice only in the create branch; leave replacement behavior unchanged.
- [Multiple selected tabs appear independently configurable] → State that the choice applies to all selected tabs and keep it alongside the other shared connection settings.
- [UI and server defaults diverge] → Default both layers to workspace-visible and add tests for explicit false and omitted input.

## Migration Plan

1. Deploy the backward-compatible API, provider type, and import behavior together with the UI.
2. New connections persist an explicit boolean; legacy connections continue resolving missing values to visible.
3. No data backfill or local Supabase service is required.
4. Rollback is application-only: older code ignores the extra JSONB field, and existing dataset visibility remains unchanged.

## Open Questions

None.
