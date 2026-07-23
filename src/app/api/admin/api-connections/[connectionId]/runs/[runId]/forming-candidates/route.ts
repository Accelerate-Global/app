import { after } from "next/server";

import {
  executeImbFormingRun,
  listImbFormingRuns,
  startImbFormingRun,
} from "@/lib/imb-forming";
import { ImbFormingError } from "@/lib/imb-forming/types";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = {
  params: Promise<{ connectionId: string; runId: string }>;
};

export const GET = withRoute(
  { access: "admin", action: "view dataset forming candidates" },
  async (_identity, _request: Request, context: Context) => {
    const { connectionId, runId } = await context.params;
    try {
      return Response.json({
        formingRuns: await listImbFormingRuns({
          connectionId,
          sourceRunId: runId,
        }),
      });
    } catch (error) {
      logError("Failed to load dataset forming candidates", error);
      return jsonError("Could not load dataset forming candidates.", 500);
    }
  },
);

export const POST = withRoute(
  { access: "admin", action: "build dataset forming candidates" },
  async (identity, _request: Request, context: Context) => {
    const { connectionId, runId } = await context.params;
    try {
      const formingRun = await startImbFormingRun({
        connectionId,
        sourceRunId: runId,
        identity,
      });
      after(async () => {
        await executeImbFormingRun(formingRun.id);
      });
      return Response.json({ formingRun }, { status: 202 });
    } catch (error) {
      if (error instanceof ImbFormingError) {
        return jsonError(error.message, error.status);
      }
      logError("Failed to start dataset forming candidate", error);
      return jsonError("Could not start the dataset forming candidate.", 500);
    }
  },
);
