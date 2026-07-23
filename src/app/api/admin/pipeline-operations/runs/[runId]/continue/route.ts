import { after } from "next/server";

import { jsonError } from "@/lib/http";
import {
  executePipelineUntilPause,
  getPipelineFlowRun,
} from "@/lib/pipeline-operations";
import { withRoute } from "@/lib/route-guard";

export const maxDuration = 300;

type Context = { params: Promise<{ runId: string }> };

export const POST = withRoute(
  { access: "admin", action: "continue pipelines" },
  async (_identity, _request: Request, context: Context) => {
    const { runId } = await context.params;
    const run = await getPipelineFlowRun(runId);
    if (!run) return jsonError("Pipeline run not found.", 404);
    if (run.status !== "queued" && run.status !== "running") {
      return jsonError("Only queued or running pipelines can continue.", 409);
    }
    after(async () => {
      await executePipelineUntilPause({ runId });
    });
    return Response.json({ accepted: true, runId }, { status: 202 });
  },
);
