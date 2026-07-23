import { getAxIdentityRun } from "@/lib/identity-registry";
import { identityRegistryRouteError } from "@/lib/identity-registry/http";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };

export const GET = withRoute(
  { access: "admin", action: "view AX identity candidate details" },
  async (_identity, _request: Request, context: Context) => {
    try {
      const { runId } = await context.params;
      const run = await getAxIdentityRun(runId);
      if (!run) return jsonError("Identity candidate not found.", 404);
      return Response.json({ run });
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to load AX identity candidate",
        "Could not load the AX identity candidate.",
        error,
      );
    }
  },
);
