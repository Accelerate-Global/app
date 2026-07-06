import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

export const PATCH = withRoute(
  { access: "admin", action: "manage API connections" },
  async (_identity, request: Request) => {
    await request.body?.cancel();
    return jsonError(
      "API connection profiles are managed from the codebase.",
      405,
    );
  },
);

export const DELETE = withRoute(
  { access: "admin", action: "manage API connections" },
  async () => {
    return jsonError(
      "API connection profiles are managed from the codebase.",
      405,
    );
  },
);
