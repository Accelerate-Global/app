import { getAnalyticsWorkspaceRole, isAppAnalyticsEventName, isAppAnalyticsRoute } from "@/lib/analytics";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { persistAnalyticsEvent } from "@/lib/analytics-store";
import { withRoute } from "@/lib/route-guard";
import { WORKSPACE_ROLES } from "@/lib/workspace-role";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_ANALYTICS_BODY_BYTES = 32 * 1024;
const MAX_ANALYTICS_PAYLOAD_KEYS = 40;
const MAX_CONTEXT_LENGTH = 160;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidOptionalUuid(value: unknown) {
  return value === undefined || (typeof value === "string" && UUID_PATTERN.test(value));
}

function isValidWorkspaceRole(value: unknown) {
  return (
    value === "anonymous" ||
    value === "viewer" ||
    (typeof value === "string" && WORKSPACE_ROLES.includes(value as (typeof WORKSPACE_ROLES)[number]))
  );
}

function isValidAnalyticsPayload(payload: unknown): payload is Record<string, unknown> {
  if (!isPlainObject(payload)) {
    return false;
  }

  return (
    Object.keys(payload).length <= MAX_ANALYTICS_PAYLOAD_KEYS &&
    typeof payload.route === "string" &&
    isAppAnalyticsRoute(payload.route) &&
    typeof payload.actor_owner_id === "string" &&
    payload.actor_owner_id.length > 0 &&
    payload.actor_owner_id.length <= MAX_CONTEXT_LENGTH &&
    isValidWorkspaceRole(payload.workspace_role) &&
    typeof payload.source_surface === "string" &&
    payload.source_surface.length > 0 &&
    payload.source_surface.length <= MAX_CONTEXT_LENGTH &&
    typeof payload.success === "boolean" &&
    (payload.error_code === undefined ||
      (typeof payload.error_code === "string" &&
        payload.error_code.length <= MAX_CONTEXT_LENGTH)) &&
    (payload.duration_ms === undefined ||
      (typeof payload.duration_ms === "number" &&
        Number.isFinite(payload.duration_ms) &&
        payload.duration_ms >= 0)) &&
    isValidOptionalUuid(payload.dataset_id) &&
    isValidOptionalUuid(payload.saved_table_id) &&
    (payload.target_user_id === undefined ||
      (typeof payload.target_user_id === "string" &&
        payload.target_user_id.length <= MAX_CONTEXT_LENGTH))
  );
}

export const POST = withRoute({ access: "user" }, async (identity, request: Request) => {
  const rawBody = await request.text();
  const body =
    Buffer.byteLength(rawBody, "utf8") <= MAX_ANALYTICS_BODY_BYTES
      ? (() => {
          try {
            return JSON.parse(rawBody) as unknown;
          } catch {
            return null;
          }
        })()
      : null;

  if (
    !isPlainObject(body) ||
    typeof body.name !== "string" ||
    !isAppAnalyticsEventName(body.name) ||
    !isValidAnalyticsPayload(body.payload)
  ) {
    return jsonError("Analytics payload is invalid.");
  }

  const payload = {
    ...body.payload,
    actor_owner_id: identity.ownerId,
    workspace_role: getAnalyticsWorkspaceRole(identity.workspaceRole),
  };

  try {
    await persistAnalyticsEvent(body.name, payload);
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    logError("Failed to persist analytics event", error);
    return jsonError("Could not store the analytics event.", 500);
  }
});
