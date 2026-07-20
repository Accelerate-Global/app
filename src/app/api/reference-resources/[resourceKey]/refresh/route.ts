import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { refreshReferenceResourceCandidate } from "@/lib/reference-resources/refresh";
import { isReferenceResourceKey } from "@/lib/reference-resources/types";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ resourceKey: string }> };

export const POST = withRoute(
  { access: "admin", action: "refresh reference resources" },
  async (identity, _request: Request, context: Context) => {
    const { resourceKey } = await context.params;
    if (!isReferenceResourceKey(resourceKey)) return jsonError("Reference resource not found.", 404);
    try {
      return Response.json(
        await refreshReferenceResourceCandidate({
          resourceKey,
          actorOwnerId: identity.ownerId,
        }),
      );
    } catch (error) {
      logError(`Failed to refresh reference resource ${resourceKey}`, error);
      return jsonError("Could not refresh reference resource.", 502);
    }
  },
);
