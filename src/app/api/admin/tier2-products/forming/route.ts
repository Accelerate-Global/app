import {
  buildTier2PartnerFormingCandidate,
  getCurrentTier2RegistryRevisionBinding,
  listTier2PartnerFormingRuns,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { z } from "zod";

const buildSchema = z.object({ profileId: z.string().uuid(), sourceRunId: z.string().uuid() }).strict();

export const GET = withRoute(
  { access: "admin", action: "view Tier 2 forming candidates" },
  async () => Response.json({ runs: await listTier2PartnerFormingRuns() }),
);

export const POST = withRoute(
  { access: "admin", action: "build Tier 2 forming candidates" },
  async (identity, request: Request) => {
    const parsed = buildSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Choose an exact partner profile and ingestion run.", 400);
    try {
      const registryRevision = await getCurrentTier2RegistryRevisionBinding();
      return Response.json({
        run: await buildTier2PartnerFormingCandidate({
          ...parsed.data,
          baseRegistryRevisionId: registryRevision.id,
          baseRegistryRevisionChecksum: registryRevision.checksum,
          actorOwnerId: identity.ownerId,
          actorEmail: identity.email,
        }),
      }, { status: 201 });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to build Tier 2 forming candidate",
        "Could not build the Tier 2 forming candidate.",
        error,
      );
    }
  },
);
