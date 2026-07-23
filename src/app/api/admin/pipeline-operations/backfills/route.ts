import { after } from "next/server";

import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import {
  assertCompleteBackfillInputs,
  assertExactBackfillInputs,
  assertPinnedReferenceResourceSnapshot,
  createPipelineFlowRun,
  executePipelineUntilPause,
  getPipelineFlowDefinition,
  isPipelineOperationError,
  pipelineBackfillSchema,
} from "@/lib/pipeline-operations";
import { withRoute } from "@/lib/route-guard";

export const maxDuration = 300;

export const POST = withRoute(
  { access: "admin", action: "backfill pipelines" },
  async (identity, request: Request) => {
    const parsed = pipelineBackfillSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Pipeline backfill payload is invalid.");
    const definition = getPipelineFlowDefinition(parsed.data.definitionKey);
    if (!definition) return jsonError("Pipeline definition not found.", 404);
    try {
      assertExactBackfillInputs(parsed.data.exactInputs);
      assertCompleteBackfillInputs(definition, parsed.data.exactInputs);
      if (definition.stages.some((stage) => stage.kind === "forming")) {
        await assertPinnedReferenceResourceSnapshot(parsed.data.exactInputs);
      }
      const result = await createPipelineFlowRun({
        definition,
        launchKind: "backfill",
        exactInputs: parsed.data.exactInputs,
        idempotencyKey: `backfill:${definition.key}:${parsed.data.requestId}`,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      });
      if (result.created) {
        after(async () => {
          await executePipelineUntilPause({ runId: result.run.id });
        });
      }
      return Response.json(result, { status: result.created ? 202 : 200 });
    } catch (error) {
      logError("Failed to create pipeline backfill", error);
      if (isPipelineOperationError(error)) {
        return jsonError(error.message, error.status);
      }
      return jsonError("Backfill could not be created.", 500);
    }
  },
);
