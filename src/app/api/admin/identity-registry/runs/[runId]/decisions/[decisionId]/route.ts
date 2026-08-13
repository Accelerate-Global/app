import { z } from "zod";

import { reviewAxIdentityChangeDecision } from "@/lib/identity-registry";
import { identityRegistryRouteError } from "@/lib/identity-registry/http";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = {
  params: Promise<{ runId: string; decisionId: string }>;
};
const schema = z.object({
  action: z.enum(["rebind", "new-identity", "canonical-supersession"]),
});

export const POST = withRoute(
  { access: "admin", action: "review AX identity component changes" },
  async (identity, request: Request, context: Context) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Identity change action is invalid.");
    try {
      const { runId, decisionId } = await context.params;
      return Response.json({
        run: await reviewAxIdentityChangeDecision({
          runId,
          decisionId,
          action: parsed.data.action,
          identity,
        }),
      });
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to review AX identity component change",
        "Could not record the AX identity change decision.",
        error,
      );
    }
  },
);
