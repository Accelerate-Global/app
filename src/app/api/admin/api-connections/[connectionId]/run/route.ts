import { after } from "next/server";
import { start } from "workflow/api";

import {
  JOSHUA_PROJECT_API_CONNECTION_ID,
  executeApiConnectionRun,
  startApiConnectionRun,
} from "@/lib/api-connections";
import {
  attachDurableJoshuaWorkflow,
  failDurableJoshuaRun,
} from "@/lib/api-connections/durable-joshua";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { apiConnectionRunSchema } from "@/lib/validation";
import { joshuaProjectRunWorkflow } from "@/workflows/joshua-project-run";

type ApiConnectionRunContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

export const maxDuration = 300;

export const POST = withRoute(
  { access: "admin", action: "run API connections" },
  async (identity, request: Request, context: ApiConnectionRunContext) => {
    const parsed = apiConnectionRunSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("API connection run payload is invalid.");
    }

    const { connectionId } = await context.params;

    try {
      const result = await startApiConnectionRun({
        connectionId,
        identity,
        importEnabled: parsed.data.importEnabled,
      });

      if (!result) {
        return jsonError("API connection not found.", 404);
      }

      if (result.connection.id === JOSHUA_PROJECT_API_CONNECTION_ID) {
        try {
          const workflowRun = await start(joshuaProjectRunWorkflow, [
            result.run.id,
          ]);
          await attachDurableJoshuaWorkflow({
            runId: result.run.id,
            workflowRunId: workflowRun.runId,
          });
        } catch (error) {
          await failDurableJoshuaRun({
            runId: result.run.id,
            message: "The durable run could not be started.",
          });
          throw error;
        }
      } else {
        after(async () => {
          await executeApiConnectionRun({ runId: result.run.id });
        });
      }

      return Response.json(result, { status: 202 });
    } catch (error) {
      logError("Failed to run API connection", error);
      return jsonError("Could not run the API connection.", 500);
    }
  },
);
