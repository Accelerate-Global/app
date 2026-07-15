import { getPartnerExportArtifactDownload } from "@/lib/partner-exports";
import { partnerExportArtifactFormatSchema } from "@/lib/partner-exports/schemas";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ datasetId: string; runId: string }> };

export const GET = withRoute(
  { access: "admin", action: "download partner export artifacts" },
  async (_identity, request: Request, context: Context) => {
    const parsed = partnerExportArtifactFormatSchema.safeParse(
      new URL(request.url).searchParams.get("format") ?? "csv",
    );
    if (!parsed.success) {
      return jsonError("Artifact format must be csv, crosswalk, or validation.");
    }

    const { datasetId, runId } = await context.params;
    try {
      const download = await getPartnerExportArtifactDownload({
        datasetId,
        runId,
        kind: parsed.data,
      });
      if (!download) {
        return jsonError("Partner export artifact not found.", 404);
      }

      return new Response(download.body, {
        headers: {
          "Content-Type": download.contentType,
          "Content-Disposition": `attachment; filename="${download.fileName}"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      logError("Failed to download partner export artifact", error);
      return jsonError("Could not download partner export artifact.", 502);
    }
  },
);
