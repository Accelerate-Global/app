import { getImbFormingRun } from "@/lib/imb-forming";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = {
  params: Promise<{
    connectionId: string;
    runId: string;
    formingRunId: string;
  }>;
};

export const GET = withRoute(
  { access: "admin", action: "view IMB forming candidates" },
  async (_identity, _request: Request, context: Context) => {
    const { connectionId, runId, formingRunId } = await context.params;
    try {
      const formingRun = await getImbFormingRun({
        connectionId,
        sourceRunId: runId,
        formingRunId,
      });
      if (!formingRun) return jsonError("IMB forming candidate not found.", 404);
      return Response.json({ formingRun });
    } catch (error) {
      logError("Failed to load IMB forming candidate", error);
      return jsonError("Could not load the IMB forming candidate.", 500);
    }
  },
);
