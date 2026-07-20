import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { refreshReferenceResourceCandidate } from "@/lib/reference-resources/refresh";
import { ROP_RESOURCE_KEY } from "@/lib/reference-resources/types";

export function GET() {
  return Response.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export const POST = withRoute(
  { access: "admin", action: "refresh ROP codes" },
  async (identity) => {
    try {
      return Response.json(
        await refreshReferenceResourceCandidate({
          resourceKey: ROP_RESOURCE_KEY,
          actorOwnerId: identity.ownerId,
        }),
      );
    } catch (error) {
      logError("Failed to refresh ROP codes", error);
      return jsonError("Could not refresh ROP codes.", 502);
    }
  },
);
