import { getRun } from "workflow/api";

import { getApiConnectionRunDetail } from "@/lib/api-connections";
import { cancelApiConnectionRun } from "@/lib/api-connections/durable-joshua";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type CancelRunContext = {
  params: Promise<{ connectionId: string; runId: string }>;
};

export const POST = withRoute(
  { access: "admin", action: "cancel API connection runs" },
  async (_identity, _request: Request, context: CancelRunContext) => {
    const { connectionId, runId } = await context.params;

    try {
      const cancelled = await cancelApiConnectionRun({ connectionId, runId });
      if (!cancelled) {
        const retained = await getApiConnectionRunDetail({ connectionId, runId });
        return retained
          ? jsonError("Only queued or running API connection runs can be cancelled.", 409)
          : jsonError("API connection run not found.", 404);
      }

      if (cancelled.workflowRunId) {
        try {
          await getRun(cancelled.workflowRunId).cancel();
        } catch (error) {
          logError("Failed to cancel durable workflow runtime", error);
        }
      }

      const run = await getApiConnectionRunDetail({ connectionId, runId });
      return Response.json({ run });
    } catch (error) {
      logError("Failed to cancel API connection run", error);
      return jsonError("Could not cancel the API connection run.", 500);
    }
  },
);
