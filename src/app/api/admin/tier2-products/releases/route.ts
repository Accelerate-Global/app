import {
  createTier2ProductRelease,
  createTier2ReleaseSchema,
  getTier2AdminOverview,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

export const GET = withRoute(
  { access: "admin", action: "view Tier 2 releases" },
  async () => Response.json(await getTier2AdminOverview()),
);

export const POST = withRoute(
  { access: "admin", action: "build Tier 2 releases" },
  async (identity, request: Request) => {
    const parsed = createTier2ReleaseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Choose exact compatible release inputs and a reason.", 400);
    try {
      return Response.json({
        run: await createTier2ProductRelease({
          ...parsed.data,
          actorOwnerId: identity.ownerId,
          actorEmail: identity.email,
        }),
      }, { status: 201 });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to build Tier 2 release",
        "Could not build the Tier 2 release.",
        error,
      );
    }
  },
);
