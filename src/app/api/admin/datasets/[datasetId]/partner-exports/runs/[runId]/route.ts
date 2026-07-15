import { getPartnerExportRun } from "@/lib/partner-exports";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ datasetId: string; runId: string }> };

export const GET = withRoute(
  { access: "admin", action: "view partner export runs" },
  async (_identity, _request: Request, context: Context) => {
    const { datasetId, runId } = await context.params;
    const run = await getPartnerExportRun({ datasetId, runId });
    return run
      ? Response.json({ run })
      : jsonError("Partner export run not found.", 404);
  },
);
