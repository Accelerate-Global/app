import {
  buildTier2PartnerIdentityCandidate,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { z } from "zod";

const schema = z.object({
  formingRunId: z.string().uuid(),
  sourcePublicationId: z.string().uuid().optional(),
}).strict();

export const POST = withRoute(
  { access: "admin", action: "build Tier 2 identity candidates" },
  async (identity, request: Request) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Choose an exact published forming candidate.", 400);
    try {
      return Response.json({ candidate: await buildTier2PartnerIdentityCandidate({
        ...parsed.data,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      }) }, { status: 201 });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to build Tier 2 identity candidate",
        "Could not build the Tier 2 identity candidate.",
        error,
      );
    }
  },
);
