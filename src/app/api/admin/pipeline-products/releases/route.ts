import { finalizePipelineReleaseSet, PipelineProductError } from "@/lib/pipeline-products";
import { finalizePipelineReleaseSchema } from "@/lib/pipeline-products/validation";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

export const POST = withRoute(
  { access: "admin", action: "finalize pipeline releases" },
  async (identity, request: Request) => {
    const parsed = finalizePipelineReleaseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Pipeline release payload is invalid.", 400);
    try {
      const release = await finalizePipelineReleaseSet({
        ...parsed.data,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      });
      return Response.json({ release }, { status: 201 });
    } catch (error) {
      if (error instanceof PipelineProductError) return jsonError(error.message, error.status);
      logError("Failed to finalize pipeline release", error);
      return jsonError("Could not finalize the pipeline release.", 500);
    }
  },
);
