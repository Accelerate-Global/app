import { z } from "zod";

import { publishAxIdentityCandidate } from "@/lib/identity-registry";
import { identityRegistryRouteError } from "@/lib/identity-registry/http";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };
const schema = z.object({ reason: z.string().trim().min(1).max(500) });

export const POST = withRoute(
  { access: "admin", action: "publish AX identity candidates" },
  async (identity, request: Request, context: Context) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return jsonError("A publication reason is required.");
    try {
      const { runId } = await context.params;
      return Response.json(
        await publishAxIdentityCandidate({ runId, reason: parsed.data.reason, identity }),
      );
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to publish AX identity candidate",
        "Could not publish the AX identity candidate.",
        error,
      );
    }
  },
);
