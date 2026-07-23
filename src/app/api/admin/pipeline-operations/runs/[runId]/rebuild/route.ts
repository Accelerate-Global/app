import { after } from "next/server";

import { jsonError } from "@/lib/http";
import {
  createPipelineFlowRun,
  executePipelineUntilPause,
  getPipelineFlowDefinition,
  getPipelineFlowRun,
  pipelineRebuildSchema,
  snapshotCurrentPipelineInputs,
} from "@/lib/pipeline-operations";
import { withRoute } from "@/lib/route-guard";

export const maxDuration = 300;

type Context = { params: Promise<{ runId: string }> };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export const POST = withRoute(
  { access: "admin", action: "rebuild pipelines" },
  async (identity, request: Request, context: Context) => {
    const parsed = pipelineRebuildSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Pipeline rebuild payload is invalid.");
    const { runId } = await context.params;
    const parent = await getPipelineFlowRun(runId);
    if (!parent) return jsonError("Pipeline run not found.", 404);
    const definition = getPipelineFlowDefinition(parent.definitionKey);
    if (!definition) return jsonError("Pipeline definition is no longer available.", 409);
    const snapshot = await snapshotCurrentPipelineInputs();
    let exactInputs = snapshot;
    if (definition.key === "tier2-partner") {
      const profileId = parent.exactInputs.profileId;
      if (typeof profileId !== "string") {
        return jsonError(
          "The original Tier 2 run has no exact partner profile.",
          409,
        );
      }
      const activeProfile = Object.values(record(snapshot.tier2ProfileBindings))
        .map(record)
        .some((profile) => profile.id === profileId);
      if (!activeProfile) {
        return jsonError(
          "The original Tier 2 partner profile is no longer active.",
          409,
        );
      }
      exactInputs = { ...snapshot, profileId };
    }
    const result = await createPipelineFlowRun({
      definition,
      launchKind: "rebuild",
      exactInputs,
      idempotencyKey: `rebuild:${definition.key}:${parsed.data.requestId}`,
      actorOwnerId: identity.ownerId,
      actorEmail: identity.email,
      parentRunId: parent.id,
    });
    if (result.created) {
      after(async () => {
        await executePipelineUntilPause({ runId: result.run.id });
      });
    }
    return Response.json(result, { status: result.created ? 202 : 200 });
  },
);
