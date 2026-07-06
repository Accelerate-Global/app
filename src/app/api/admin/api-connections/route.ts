import { listApiConnections } from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

export const GET = withRoute(
  { access: "admin", action: "manage API connections" },
  async () => {
    try {
      return Response.json(await listApiConnections());
    } catch (error) {
      logError("Failed to list API connections", error);
      return jsonError("Could not load API connections.", 500);
    }
  },
);

export const POST = withRoute(
  { access: "admin", action: "manage API connections" },
  async (_identity, request: Request) => {
    await request.body?.cancel();
    return jsonError(
      "API connection profiles are managed from the codebase.",
      405,
    );
  },
);
