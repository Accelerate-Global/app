import {
  activateTier2ContractResource,
  activateTier2ResourceSchema,
  createTier2ContractResourceVersion,
  createTier2ResourceVersionSchema,
  listTier2ContractResources,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

export const GET = withRoute(
  { access: "admin", action: "view Tier 2 contract resources" },
  async () => Response.json({ resources: await listTier2ContractResources() }),
);

export const POST = withRoute(
  { access: "admin", action: "activate Tier 2 contract resources" },
  async (identity, request: Request) => {
    const body = await request.json().catch(() => null);
    const create = createTier2ResourceVersionSchema.safeParse(body);
    const activation = activateTier2ResourceSchema.safeParse(body);
    if (!create.success && !activation.success) {
      return jsonError("Import a typed resource payload or choose a valid version activation.", 400);
    }
    try {
      if (create.success) {
        return Response.json(await createTier2ContractResourceVersion({
          ...create.data,
          actorOwnerId: identity.ownerId,
          actorEmail: identity.email,
        }), { status: 201 });
      }
      if (!activation.success) {
        return jsonError("Choose a valid resource version, action, and reason.", 400);
      }
      return Response.json({
        resources: await activateTier2ContractResource({
          ...activation.data,
          actorOwnerId: identity.ownerId,
          actorEmail: identity.email,
        }),
      });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to activate Tier 2 contract resource",
        "Could not activate the Tier 2 contract resource.",
        error,
      );
    }
  },
);
