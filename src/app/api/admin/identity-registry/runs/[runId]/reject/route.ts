import { z } from "zod";

import { rejectAxIdentityCandidate } from "@/lib/identity-registry";
import { identityRegistryRouteError } from "@/lib/identity-registry/http";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };
const schema = z.object({ reason: z.string().trim().min(1).max(500) });

export const POST = withRoute(
  { access: "admin", action: "reject AX identity candidates" },
  async (identity, request: Request, context: Context) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return jsonError("A rejection reason is required.");
    try {
      const { runId } = await context.params;
      return Response.json({
        run: await rejectAxIdentityCandidate({ runId, reason: parsed.data.reason, identity }),
      });
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to reject AX identity candidate",
        "Could not reject the AX identity candidate.",
        error,
      );
    }
  },
);
