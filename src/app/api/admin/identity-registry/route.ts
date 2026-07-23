import { getAxIdentityRegistryOverview } from "@/lib/identity-registry";
import { identityRegistryRouteError } from "@/lib/identity-registry/http";
import { withRoute } from "@/lib/route-guard";

export const GET = withRoute(
  { access: "admin", action: "view AX identity registry" },
  async () => {
    try {
      return Response.json(await getAxIdentityRegistryOverview());
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to load AX identity registry",
        "Could not load the AX identity registry.",
        error,
      );
    }
  },
);
