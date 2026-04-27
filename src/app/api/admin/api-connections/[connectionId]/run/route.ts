import { after } from "next/server";

import {
  executeApiConnectionRun,
  startApiConnectionRun,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { apiConnectionRunSchema } from "@/lib/validation";

type ApiConnectionRunContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

export async function POST(request: Request, context: ApiConnectionRunContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("run API connections");
  }

  const parsed = apiConnectionRunSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("API connection run payload is invalid.");
  }

  const { connectionId } = await context.params;

  try {
    const result = await startApiConnectionRun({
      connectionId,
      identity,
      importEnabled: parsed.data.importEnabled,
    });

    if (!result) {
      return jsonError("API connection not found.", 404);
    }

    after(async () => {
      await executeApiConnectionRun({ runId: result.run.id });
    });

    return Response.json(result, { status: 202 });
  } catch (error) {
    logError("Failed to run API connection", error);
    return jsonError("Could not run the API connection.", 500);
  }
}
