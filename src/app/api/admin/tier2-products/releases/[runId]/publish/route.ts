import {
  publishTier2ProductRun,
  publishTier2RunSchema,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };

export const POST = withRoute(
  { access: "admin", action: "publish Tier 2 releases" },
  async (identity, request: Request, context: Context) => {
    const parsed = publishTier2RunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("A warning decision and publication reason are required.", 400);
    try {
      return Response.json(await publishTier2ProductRun({
        runId: (await context.params).runId,
        ...parsed.data,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      }));
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to publish Tier 2 release",
        "Could not publish the Tier 2 release.",
        error,
      );
    }
  },
);
