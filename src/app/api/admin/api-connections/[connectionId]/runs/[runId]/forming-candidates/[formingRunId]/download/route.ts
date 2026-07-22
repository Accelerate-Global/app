import { getImbFormingArtifactDownload } from "@/lib/imb-forming";
import { imbFormingArtifactKindSchema } from "@/lib/imb-forming/schemas";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = {
  params: Promise<{
    connectionId: string;
    runId: string;
    formingRunId: string;
  }>;
};

export const GET = withRoute(
  { access: "admin", action: "download IMB forming artifacts" },
  async (_identity, request: Request, context: Context) => {
    const kind = imbFormingArtifactKindSchema.safeParse(
      new URL(request.url).searchParams.get("kind"),
    );
    if (!kind.success) return jsonError("Artifact kind is invalid.");
    const { connectionId, runId, formingRunId } = await context.params;
    try {
      const download = await getImbFormingArtifactDownload({
        connectionId,
        sourceRunId: runId,
        formingRunId,
        kind: kind.data,
      });
      if (!download) return jsonError("IMB forming artifact not found.", 404);
      return new Response(download.body, {
        headers: {
          "Content-Type": download.contentType,
          "Content-Disposition": `attachment; filename="${download.fileName}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (error) {
      logError("Failed to download IMB forming artifact", error);
      return jsonError("Could not download the IMB forming artifact.", 500);
    }
  },
);
