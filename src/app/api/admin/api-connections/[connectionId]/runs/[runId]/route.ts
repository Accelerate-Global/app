import { getApiConnectionRunDetail } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

type ApiConnectionRunDetailContext = {
  params: Promise<{
    connectionId: string;
    runId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: ApiConnectionRunDetailContext,
) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("view API connection runs");
  }

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
}
