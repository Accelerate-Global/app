import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import {
  configurePipelineSchedule,
  isPipelineOperationError,
  pipelineScheduleSchema,
} from "@/lib/pipeline-operations";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ definitionKey: string }> };

export const PATCH = withRoute(
  { access: "admin", action: "configure pipeline schedules" },
  async (identity, request: Request, context: Context) => {
    const parsed = pipelineScheduleSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Pipeline schedule payload is invalid.");
    const { definitionKey } = await context.params;
    try {
      await configurePipelineSchedule({
        definitionKey,
        actorOwnerId: identity.ownerId,
        ...parsed.data,
      });
      return Response.json({
        configured: true,
        definitionKey,
        sourceProfileId: parsed.data.sourceProfileId ?? null,
      });
    } catch (error) {
      logError("Failed to configure pipeline schedule", error);
      if (isPipelineOperationError(error)) {
        return jsonError(error.message, error.status);
      }
      return jsonError("Schedule could not be configured.", 500);
    }
  },
);
