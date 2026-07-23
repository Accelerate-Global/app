import { PipelineProductError, rejectPipelineRun } from "@/lib/pipeline-products";
import { pipelineRunDecisionSchema } from "@/lib/pipeline-products/validation";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };

export const POST = withRoute(
  { access: "admin", action: "reject pipeline candidates" },
  async (identity, request: Request, context: Context) => {
    const parsed = pipelineRunDecisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Pipeline rejection payload is invalid.", 400);
    try {
      const run = await rejectPipelineRun({
        runId: (await context.params).runId,
        reason: parsed.data.reason,
        actorOwnerId: identity.ownerId,
      });
      return Response.json({ run });
    } catch (error) {
      if (error instanceof PipelineProductError) return jsonError(error.message, error.status);
      logError("Failed to reject pipeline candidate", error);
      return jsonError("Could not reject the pipeline candidate.", 500);
    }
  },
);
