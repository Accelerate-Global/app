import { getPipelineRun } from "@/lib/pipeline-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };

export const GET = withRoute(
  { access: "admin", action: "review pipeline runs" },
  async (_identity, _request: Request, context: Context) => {
    const run = await getPipelineRun((await context.params).runId);
    return run ? Response.json({ run }) : jsonError("Pipeline run not found.", 404);
  },
);
