import { getApiConnectionRunDetail } from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type ApiConnectionRunDetailContext = {
  params: Promise<{
    connectionId: string;
    runId: string;
  }>;
};

export const GET = withRoute(
  { access: "admin", action: "view API connection runs" },
  async (
    _identity,
    _request: Request,
    context: ApiConnectionRunDetailContext,
  ) => {
    const { connectionId, runId } = await context.params;

    try {
      const run = await getApiConnectionRunDetail({ connectionId, runId });

      if (!run) {
        return jsonError("API connection run not found.", 404);
      }

      return Response.json({ run });
    } catch (error) {
      logError("Failed to load API connection run", error);
      return jsonError("Could not load the API connection run.", 500);
    }
  },
);
