import { publishImbFormingRun } from "@/lib/imb-forming";
import { imbFormingDecisionSchema } from "@/lib/imb-forming/schemas";
import { ImbFormingError } from "@/lib/imb-forming/types";
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

export const POST = withRoute(
  { access: "admin", action: "publish dataset forming candidates" },
  async (identity, request: Request, context: Context) => {
    const decision = imbFormingDecisionSchema.safeParse(await request.json());
    if (!decision.success) return jsonError("A publication reason is required.");
    const { connectionId, runId, formingRunId } = await context.params;
    try {
      return Response.json({
        formingRun: await publishImbFormingRun({
          connectionId,
          sourceRunId: runId,
          formingRunId,
          identity,
          decision: decision.data,
        }),
      });
    } catch (error) {
      if (error instanceof ImbFormingError) return jsonError(error.message, error.status);
      logError("Failed to publish dataset forming candidate", error);
      return jsonError("Could not publish the dataset forming candidate.", 500);
    }
  },
);
