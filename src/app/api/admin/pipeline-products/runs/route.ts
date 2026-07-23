import {
  buildPipelineProduct,
  listPipelineRuns,
  PipelineProductError,
} from "@/lib/pipeline-products";
import { buildPipelineProductSchema } from "@/lib/pipeline-products/validation";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

export const GET = withRoute(
  { access: "admin", action: "review pipeline runs" },
  async () => Response.json({ runs: await listPipelineRuns() }),
);
export const POST = withRoute(
  { access: "admin", action: "build pipeline products" },
  async (identity, request: Request) => {
    const parsed = buildPipelineProductSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Pipeline build payload is invalid.", 400);
    try {
      const run = await buildPipelineProduct({
        ...parsed.data,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      });
      return Response.json({ run }, { status: 201 });
    } catch (error) {
      if (error instanceof PipelineProductError) return jsonError(error.message, error.status);
      logError("Failed to build pipeline product", error);
      return jsonError("Could not build the pipeline product.", 500);
    }
  },
);
