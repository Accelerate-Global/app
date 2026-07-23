import { PipelineProductError, publishPipelineRun } from "@/lib/pipeline-products";
import { publishPipelineRunSchema } from "@/lib/pipeline-products/validation";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };

export const POST = withRoute(
  { access: "admin", action: "publish pipeline products" },
  async (identity, request: Request, context: Context) => {
    const parsed = publishPipelineRunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Pipeline publication payload is invalid.", 400);
    try {
      const run = await publishPipelineRun({
        runId: (await context.params).runId,
        reason: parsed.data.reason,
        acknowledgeWarnings: parsed.data.acknowledgeWarnings,
        expectedCurrentPublicationId: parsed.data.expectedCurrentPublicationId,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      });
      return Response.json({ run });
    } catch (error) {
      if (error instanceof PipelineProductError) return jsonError(error.message, error.status);
      logError("Failed to publish pipeline product", error);
      return jsonError("Could not publish the pipeline product.", 500);
    }
  },
);
