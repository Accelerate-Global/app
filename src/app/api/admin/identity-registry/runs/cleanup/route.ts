import { expireStaleAxIdentityReservations } from "@/lib/identity-registry";
import { identityRegistryRouteError } from "@/lib/identity-registry/http";
import { withRoute } from "@/lib/route-guard";

export const POST = withRoute(
  { access: "admin", action: "expire stale AX identity reservations" },
  async () => {
    try {
      return Response.json({ expiredCount: await expireStaleAxIdentityReservations() });
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to expire stale AX identity reservations",
        "Could not expire stale AX identity reservations.",
        error,
      );
    }
  },
);
