import { after } from "next/server";
import { z } from "zod";

import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import {
  createPipelineFlowRun,
  executePipelineUntilPause,
  getPipelineFlowDefinition,
  snapshotCurrentPipelineInputs,
} from "@/lib/pipeline-operations";
import { withRoute } from "@/lib/route-guard";

export const maxDuration = 300;

const schema = z.object({
  profileId: z.string().uuid(),
  requestId: z.string().uuid(),
}).strict();

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export const POST = withRoute(
  { access: "admin", action: "run Tier 2 partner pipelines" },
  async (identity, request: Request) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Choose an exact Tier 2 partner profile.", 400);
    try {
      const snapshot = await snapshotCurrentPipelineInputs();
      const profiles = record(snapshot.tier2ProfileBindings);
      const selected = Object.values(profiles)
        .map(record)
        .find((profile) => profile.id === parsed.data.profileId);
      if (!selected) {
        return jsonError("The selected Tier 2 partner profile is no longer active.", 409);
      }
      const definition = getPipelineFlowDefinition("tier2-partner");
      if (!definition) return jsonError("The Tier 2 partner flow is unavailable.", 409);
      const result = await createPipelineFlowRun({
        definition,
        launchKind: "manual",
        exactInputs: {
          ...snapshot,
          profileId: parsed.data.profileId,
          coordinator: {
            ...record(snapshot.coordinator),
            profileId: parsed.data.profileId,
            sourceProfileKey: "tier2-partner",
          },
        },
        idempotencyKey: `manual:tier2-partner:${parsed.data.profileId}:${parsed.data.requestId}`,
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
      logError("Failed to launch Tier 2 partner flow", error);
      return jsonError("Could not launch the Tier 2 partner flow.", 500);
    }
  },
);
