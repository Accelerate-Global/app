import { listApiConnectionRuns } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

type ApiConnectionRunsContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

export async function GET(_request: Request, context: ApiConnectionRunsContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("view API connection runs");
  }

  const { connectionId } = await context.params;

  try {
    return Response.json({ runs: await listApiConnectionRuns(connectionId) });
  } catch (error) {
    logError("Failed to list API connection runs", error);
    return jsonError("Could not load API connection runs.", 500);
  }
}
