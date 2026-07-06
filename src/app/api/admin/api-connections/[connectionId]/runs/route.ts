import { listApiConnectionRuns } from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type ApiConnectionRunsContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

export const GET = withRoute(
  { access: "admin", action: "view API connection runs" },
  async (_identity, _request: Request, context: ApiConnectionRunsContext) => {
    const { connectionId } = await context.params;

    try {
      return Response.json({ runs: await listApiConnectionRuns(connectionId) });
    } catch (error) {
      logError("Failed to list API connection runs", error);
      return jsonError("Could not load API connection runs.", 500);
    }
  },
);
