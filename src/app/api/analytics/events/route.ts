import { getAnalyticsWorkspaceRole, isAppAnalyticsEventName, isAppAnalyticsRoute } from "@/lib/analytics";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { persistAnalyticsEvent } from "@/lib/analytics-store";
import { WORKSPACE_ROLES } from "@/lib/workspace-role";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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
    typeof payload.route === "string" &&
    isAppAnalyticsRoute(payload.route) &&
    typeof payload.actor_owner_id === "string" &&
    payload.actor_owner_id.length > 0 &&
    isValidWorkspaceRole(payload.workspace_role) &&
    typeof payload.source_surface === "string" &&
    payload.source_surface.length > 0 &&
    typeof payload.success === "boolean" &&
    (payload.error_code === undefined || typeof payload.error_code === "string") &&
    (payload.duration_ms === undefined ||
      (typeof payload.duration_ms === "number" &&
        Number.isFinite(payload.duration_ms) &&
        payload.duration_ms >= 0)) &&
    isValidOptionalUuid(payload.dataset_id) &&
    isValidOptionalUuid(payload.saved_table_id) &&
    (payload.target_user_id === undefined || typeof payload.target_user_id === "string")
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (
    !isPlainObject(body) ||
    typeof body.name !== "string" ||
    !isAppAnalyticsEventName(body.name) ||
    !isValidAnalyticsPayload(body.payload)
  ) {
    return jsonError("Analytics payload is invalid.");
  }

  const identity = await getCurrentIdentity();

  if (!identity) {
    if (
      body.payload.actor_owner_id !== "anonymous" ||
      body.payload.workspace_role !== "anonymous"
    ) {
      return jsonError("Unauthorized.", 401);
    }
  }

  const payload = {
    ...body.payload,
    actor_owner_id: identity ? identity.ownerId : body.payload.actor_owner_id,
    workspace_role: identity
      ? getAnalyticsWorkspaceRole(identity.workspaceRole)
      : body.payload.workspace_role,
  };

  try {
    await persistAnalyticsEvent(body.name, payload);
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    logError("Failed to persist analytics event", error);
    return jsonError("Could not store the analytics event.", 500);
  }
}
