import {
  createTier2PartnerProfile,
  listTier2PartnerProfiles,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

export const GET = withRoute(
  { access: "admin", action: "view Tier 2 partner profiles" },
  async () => Response.json({ profiles: await listTier2PartnerProfiles() }),
);

export const POST = withRoute(
  { access: "admin", action: "manage Tier 2 partner profiles" },
  async (identity, request: Request) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError("A partner profile is required.", 400);
    try {
      return Response.json({
        profile: await createTier2PartnerProfile({
          profile: "profile" in body ? body.profile : body,
          actorOwnerId: identity.ownerId,
        }),
      }, { status: 201 });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to create Tier 2 partner profile",
        "Could not create the Tier 2 partner profile.",
        error,
      );
    }
  },
);
