import { after } from "next/server";

import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import {
  createPipelineFlowRun,
  executePipelineUntilPause,
  getPipelineFlowDefinition,
  listPipelineFlowRuns,
  PIPELINE_FLOW_STATUSES,
  pipelineLaunchSchema,
  isPipelineOperationError,
  snapshotCurrentPipelineInputs,
} from "@/lib/pipeline-operations";
import { withRoute } from "@/lib/route-guard";

export const maxDuration = 300;

export const GET = withRoute(
  { access: "admin", action: "view pipeline operations" },
  async (_identity, request: Request) => {
    const url = new URL(request.url);
    const requestedStatus = url.searchParams.get("status");
    const status = PIPELINE_FLOW_STATUSES.find(
      (candidate) => candidate === requestedStatus,
    );
    if (requestedStatus && !status) {
      return jsonError("Pipeline status filter is invalid.");
    }
    try {
      return Response.json({
        runs: await listPipelineFlowRuns({
          status: status || null,
          definitionKey: url.searchParams.get("definitionKey"),
        }),
      });
    } catch (error) {
      logError("Failed to list pipeline flow runs", error);
      return jsonError("Could not load pipeline history.", 500);
    }
  },
);

export const POST = withRoute(
  { access: "admin", action: "run pipelines" },
  async (identity, request: Request) => {
    const parsed = pipelineLaunchSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Pipeline launch payload is invalid.");

    const definition = getPipelineFlowDefinition(parsed.data.definitionKey);
    if (!definition) return jsonError("Pipeline definition not found.", 404);

    try {
      const exactInputs = await snapshotCurrentPipelineInputs();

      const result = await createPipelineFlowRun({
        definition,
        launchKind: parsed.data.launchKind,
        exactInputs,
        idempotencyKey: `${parsed.data.launchKind}:${definition.key}:${parsed.data.requestId}`,
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
      logError("Failed to launch pipeline flow", error);
      if (isPipelineOperationError(error)) {
        return jsonError(error.message, error.status);
      }
      return jsonError("Could not launch the pipeline.", 500);
    }
  },
);
