import {
  getTier2PartnerProfile,
  tier2ProductRouteError,
  updateTier2PartnerProfile,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ profileId: string }> };

export const GET = withRoute(
  { access: "admin", action: "view Tier 2 partner profiles" },
  async (_identity, _request: Request, context: Context) => {
    const profile = await getTier2PartnerProfile((await context.params).profileId);
    return profile ? Response.json({ profile }) : jsonError("Tier 2 partner profile not found.", 404);
  },
);

export const PATCH = withRoute(
  { access: "admin", action: "manage Tier 2 partner profiles" },
  async (identity, request: Request, context: Context) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError("A partner profile is required.", 400);
    try {
      return Response.json({
        profile: await updateTier2PartnerProfile({
          profileId: (await context.params).profileId,
          profile: "profile" in body ? body.profile : body,
          actorOwnerId: identity.ownerId,
        }),
      });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to update Tier 2 partner profile",
        "Could not update the Tier 2 partner profile.",
        error,
      );
    }
  },
);
