import {
  rejectTier2ProductRun,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { z } from "zod";

type Context = { params: Promise<{ runId: string }> };
const schema = z.object({ reason: z.string().trim().min(3) }).strict();

export const POST = withRoute(
  { access: "admin", action: "reject Tier 2 releases" },
  async (identity, request: Request, context: Context) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("A rejection reason is required.", 400);
    try {
      return Response.json({ run: await rejectTier2ProductRun({
        runId: (await context.params).runId,
        reason: parsed.data.reason,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      }) });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to reject Tier 2 release",
        "Could not reject the Tier 2 release.",
        error,
      );
    }
  },
);
