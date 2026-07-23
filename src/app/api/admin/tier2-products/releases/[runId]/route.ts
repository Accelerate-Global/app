import { getTier2ProductRun } from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };

export const GET = withRoute(
  { access: "admin", action: "view Tier 2 releases" },
  async (_identity, _request: Request, context: Context) => {
    const run = await getTier2ProductRun((await context.params).runId);
    return run ? Response.json({ run }) : jsonError("Tier 2 product run not found.", 404);
  },
);
