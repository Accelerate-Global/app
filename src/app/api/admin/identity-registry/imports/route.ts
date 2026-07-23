import { z } from "zod";

import { importLegacyIdentitySnapshots } from "@/lib/identity-registry";
import { identityRegistryRouteError } from "@/lib/identity-registry/http";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

const schema = z.object({
  commit: z.boolean().optional().default(false),
  reason: z.string().trim().min(1).max(500).optional(),
  snapshots: z.array(
    z.object({
      path: z.string().trim().min(1).max(500),
      expectedChecksum: z.string().regex(/^[0-9a-f]{64}$/u),
      body: z.string().max(20 * 1024 * 1024),
    }),
  ).min(1).max(10),
});

export const POST = withRoute(
  { access: "admin", action: "import legacy AX identity snapshots" },
  async (identity, request: Request) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return jsonError("Legacy identity import payload is invalid.");
    try {
      return Response.json(
        await importLegacyIdentitySnapshots({ ...parsed.data, identity }),
        { status: parsed.data.commit ? 201 : 200 },
      );
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to import legacy AX identity snapshots",
        "Could not import legacy AX identity snapshots.",
        error,
      );
    }
  },
);
