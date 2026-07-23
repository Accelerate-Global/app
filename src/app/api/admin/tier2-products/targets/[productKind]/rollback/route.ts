import {
  rollbackTier2ProductTarget,
  rollbackTier2TargetSchema,
  TIER2_PRODUCT_KINDS,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ productKind: string }> };

export const POST = withRoute(
  { access: "admin", action: "rollback Tier 2 publication targets" },
  async (identity, request: Request, context: Context) => {
    const productKind = (await context.params).productKind;
    if (!TIER2_PRODUCT_KINDS.includes(productKind as never)) {
      return jsonError("Unknown Tier 2 publication target.", 404);
    }
    const parsed = rollbackTier2TargetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Choose exact current and rollback publications with a reason.", 400);
    try {
      return Response.json(await rollbackTier2ProductTarget({
        productKind: productKind as "tier2" | "aggregate2",
        ...parsed.data,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      }));
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to rollback Tier 2 publication target",
        "Could not rollback the Tier 2 publication target.",
        error,
      );
    }
  },
);
