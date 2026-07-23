import {
  createTier2LegacyComparison,
  createTier2LegacyComparisonSchema,
  getTier2LegacyComparison,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };

export const GET = withRoute(
  { access: "admin", action: "view Tier 2 legacy comparisons" },
  async (_identity, request: Request, context: Context) => {
    try {
      const comparison = await getTier2LegacyComparison(
        (await context.params).runId,
      );
      if (!comparison) return jsonError("Legacy comparison not found.", 404);
      if (new URL(request.url).searchParams.get("download") === "1") {
        return new Response(comparison.body, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition":
              `attachment; filename="tier2-legacy-comparison-${comparison.artifact.runId}.json"`,
          },
        });
      }
      return Response.json({ comparison: comparison.artifact });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to read Tier 2 legacy comparison",
        "Could not read the Tier 2 legacy comparison.",
        error,
      );
    }
  },
);

export const POST = withRoute(
  { access: "admin", action: "retain Tier 2 legacy comparisons" },
  async (identity, request: Request, context: Context) => {
    const parsed = createTier2LegacyComparisonSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        "Upload one legacy rows JSON artifact and provide a review reason.",
        400,
      );
    }
    try {
      const comparison = await createTier2LegacyComparison({
        runId: (await context.params).runId,
        legacy: parsed.data.legacy,
        reason: parsed.data.reason,
        actorOwnerId: identity.ownerId,
        actorEmail: identity.email,
      });
      return Response.json({ comparison }, { status: 201 });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to retain Tier 2 legacy comparison",
        "Could not retain the Tier 2 legacy comparison.",
        error,
      );
    }
  },
);
