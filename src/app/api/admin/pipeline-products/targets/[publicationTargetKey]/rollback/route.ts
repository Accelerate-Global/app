import {
  PipelineProductError,
  rollbackPipelineProductTarget,
} from "@/lib/pipeline-products";
import { rollbackPipelineProductTargetSchema } from "@/lib/pipeline-products/validation";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ publicationTargetKey: string }> };

export const POST = withRoute(
  { access: "admin", action: "rollback pipeline publication targets" },
  async (identity, request: Request, context: Context) => {
    const parsed = rollbackPipelineProductTargetSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        "Choose the exact current and retained publications with a rollback reason.",
        400,
      );
    }
    try {
      return Response.json(await rollbackPipelineProductTarget({
        publicationTargetKey: (await context.params).publicationTargetKey,
        publicationId: parsed.data.publicationId,
        expectedCurrentPublicationId: parsed.data.expectedCurrentPublicationId,
        reason: parsed.data.reason,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      }));
    } catch (error) {
      if (error instanceof PipelineProductError) return jsonError(error.message, error.status);
      logError("Failed to rollback pipeline publication target", error);
      return jsonError("Could not rollback the pipeline publication target.", 500);
    }
  },
);
