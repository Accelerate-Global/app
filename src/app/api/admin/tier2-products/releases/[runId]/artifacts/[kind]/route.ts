import {
  downloadTier2ProductArtifact,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string; kind: string }> };
const kinds = new Set(["rows-json", "rows-csv", "findings-json", "lineage-json"] as const);

export const GET = withRoute(
  { access: "admin", action: "download Tier 2 release evidence" },
  async (_identity, _request: Request, context: Context) => {
    const { runId, kind } = await context.params;
    if (!kinds.has(kind as never)) return jsonError("Unsupported Tier 2 product artifact.", 404);
    try {
      const artifact = await downloadTier2ProductArtifact(
        runId,
        kind as "rows-json" | "rows-csv" | "findings-json" | "lineage-json",
      );
      return new Response(artifact.body, {
        headers: {
          "Content-Type": artifact.contentType,
          "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
        },
      });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to download Tier 2 release evidence",
        "Could not download the Tier 2 release evidence.",
        error,
      );
    }
  },
);
