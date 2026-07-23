import { z } from "zod";

import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import {
  rejectTier2PartnerIdentityCandidate,
  tier2ProductRouteError,
} from "@/lib/tier2-products";

type Context = { params: Promise<{ identityRunId: string }> };
const schema = z.object({ reason: z.string().trim().min(3) }).strict();

export const POST = withRoute(
  { access: "admin", action: "reject Tier 2 identity candidates" },
  async (identity, request: Request, context: Context) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("A rejection reason is required.", 400);
    try {
      return Response.json(await rejectTier2PartnerIdentityCandidate({
        identityRunId: (await context.params).identityRunId,
        reason: parsed.data.reason,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      }));
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to reject Tier 2 identity candidate",
        "Could not reject the Tier 2 identity candidate.",
        error,
      );
    }
  },
);
