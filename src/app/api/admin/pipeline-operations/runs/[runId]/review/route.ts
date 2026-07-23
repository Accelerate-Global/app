import { after } from "next/server";

import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import {
  executePipelineUntilPause,
  getPipelineFlowRun,
  pipelineReviewSchema,
  rejectPipelineReviewCandidate,
  resumePipelineReview,
} from "@/lib/pipeline-operations";
import { withRoute } from "@/lib/route-guard";

export const maxDuration = 300;

type Context = { params: Promise<{ runId: string }> };

export const POST = withRoute(
  { access: "admin", action: "review pipeline stages" },
  async (identity, request: Request, context: Context) => {
    const parsed = pipelineReviewSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Pipeline review payload is invalid.");
    const { runId } = await context.params;
    try {
      if (parsed.data.decision === "reject") {
        const run = await getPipelineFlowRun(runId);
        if (!run) return jsonError("Pipeline run not found.", 404);
        await rejectPipelineReviewCandidate({
          run,
          stageKey: parsed.data.stageKey,
          reason: parsed.data.reason,
          identity,
        });
      }
      const status = await resumePipelineReview({
        runId,
        stageKey: parsed.data.stageKey,
        actorOwnerId: identity.ownerId,
        decision: parsed.data.decision,
        reason: parsed.data.reason,
        acknowledgeWarnings: parsed.data.acknowledgeWarnings,
      });
      if (status === "queued") {
        after(async () => {
          await executePipelineUntilPause({ runId });
        });
      }
      return Response.json({ status, runId }, { status: status === "queued" ? 202 : 200 });
    } catch (error) {
      logError("Failed to record pipeline review", error);
      return jsonError("Review could not be recorded.", 409);
    }
  },
);
