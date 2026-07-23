import {
  downloadTier2PartnerFormingArtifact,
  tier2ProductRouteError,
} from "@/lib/tier2-products";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ formingRunId: string; kind: string }> };
const kinds = new Set(["rows", "findings", "manifest", "csv"] as const);

export const GET = withRoute(
  { access: "admin", action: "download Tier 2 forming evidence" },
  async (_identity, _request: Request, context: Context) => {
    const { formingRunId, kind } = await context.params;
    if (!kinds.has(kind as never)) return jsonError("Unsupported Tier 2 forming artifact.", 404);
    try {
      const artifact = await downloadTier2PartnerFormingArtifact(
        formingRunId,
        kind as "rows" | "findings" | "manifest" | "csv",
      );
      return new Response(artifact.body, {
        headers: {
          "Content-Type": artifact.contentType,
          "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
        },
      });
    } catch (error) {
      return tier2ProductRouteError(
        "Failed to download Tier 2 forming evidence",
        "Could not download the Tier 2 forming evidence.",
        error,
      );
    }
  },
);
