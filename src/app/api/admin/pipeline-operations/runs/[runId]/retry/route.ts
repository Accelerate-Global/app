import { after } from "next/server";

import { jsonError } from "@/lib/http";
import {
  executePipelineUntilPause,
  pipelineRetrySchema,
  retryPipelineStage,
} from "@/lib/pipeline-operations";
import { withRoute } from "@/lib/route-guard";

export const maxDuration = 300;

type Context = { params: Promise<{ runId: string }> };

export const POST = withRoute(
  { access: "admin", action: "retry pipeline stages" },
  async (identity, request: Request, context: Context) => {
    const parsed = pipelineRetrySchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Pipeline retry payload is invalid.");
    const { runId } = await context.params;
    const retried = await retryPipelineStage({
      runId,
      stageKey: parsed.data.stageKey,
      actorOwnerId: identity.ownerId,
      reason: parsed.data.reason,
    });
    if (!retried) return jsonError("The failed stage is no longer retryable.", 409);
    after(async () => {
      await executePipelineUntilPause({ runId });
    });
    return Response.json({ accepted: true, runId }, { status: 202 });
  },
);
