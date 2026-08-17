import { after } from "next/server";

import {
  executeApiConnectionRun,
  startApiConnectionRun,
} from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { apiConnectionRunSchema } from "@/lib/validation";

type ApiConnectionRunContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

export const maxDuration = 300;

export const POST = withRoute(
  { access: "admin", action: "run API connections" },
  async (identity, request: Request, context: ApiConnectionRunContext) => {
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
  },
);
