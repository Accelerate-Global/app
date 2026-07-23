import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { getPipelineFlowRun } from "@/lib/pipeline-operations";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };

export const GET = withRoute(
  { access: "admin", action: "view pipeline operations" },
  async (_identity, _request: Request, context: Context) => {
    try {
      const { runId } = await context.params;
      const run = await getPipelineFlowRun(runId);
      return run ? Response.json({ run }) : jsonError("Pipeline run not found.", 404);
    } catch (error) {
      logError("Failed to load pipeline flow run", error);
      return jsonError("Could not load the pipeline run.", 500);
    }
  },
);
