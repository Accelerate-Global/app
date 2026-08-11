import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { ApiConnectionError } from "@/lib/api-connections";
import { googleSheetsWorkflowAssignmentSchema } from "@/lib/api-connections/onboarding-workflows";
import {
  assignGoogleSheetsConnectionWorkflow,
  getGoogleSheetsConnectionWorkflow,
} from "@/lib/api-connections/workflow-assignments";

type Context = { params: Promise<{ connectionId: string }> };

export const GET = withRoute(
  { access: "admin", action: "view connection workflow assignments" },
  async (_identity, _request: Request, context: Context) => {
    const { connectionId } = await context.params;
    try {
      return Response.json({
        assignment: await getGoogleSheetsConnectionWorkflow(connectionId),
      });
    } catch (error) {
      logError("Failed to load connection workflow assignment", error);
      const status = error instanceof ApiConnectionError ? error.status : 500;
      return jsonError(
        error instanceof ApiConnectionError
          ? error.message
          : "Could not load the connection workflow assignment.",
        status,
      );
    }
  },
);

export const PUT = withRoute(
  { access: "admin", action: "configure connection workflow assignments" },
  async (identity, request: Request, context: Context) => {
    const { connectionId } = await context.params;
    const parsed = googleSheetsWorkflowAssignmentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success || parsed.data.kind === "none") {
      return jsonError("Choose a complete Tier 1 or Tier 2 workflow.", 400);
    }
    try {
      return Response.json({
        assignment: await assignGoogleSheetsConnectionWorkflow({
          connectionId,
          actorOwnerId: identity.ownerId,
          assignment: parsed.data,
        }),
      });
    } catch (error) {
      logError("Failed to configure connection workflow assignment", error);
      const status = error instanceof ApiConnectionError ? error.status : 500;
      return jsonError(
        error instanceof ApiConnectionError
          ? error.message
          : "The connection workflow could not be configured.",
        status,
      );
    }
  },
);
