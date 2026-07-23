import {
  publishTier2PartnerFormingCandidate,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { z } from "zod";

type Context = { params: Promise<{ formingRunId: string }> };
const schema = z.object({ reason: z.string().trim().min(3), acknowledgeWarnings: z.boolean().default(false) }).strict();

export const POST = withRoute(
  { access: "admin", action: "publish Tier 2 forming candidates" },
  async (identity, request: Request, context: Context) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("A publication reason is required.", 400);
    try {
      return Response.json(await publishTier2PartnerFormingCandidate({
        formingRunId: (await context.params).formingRunId,
        ...parsed.data,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      }));
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to publish Tier 2 forming candidate",
        "Could not publish the Tier 2 forming candidate.",
        error,
      );
    }
  },
);
