import { getApiConnectionRunOutputDownload } from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type ApiConnectionRunDownloadContext = {
  params: Promise<{
    connectionId: string;
    runId: string;
  }>;
};

function parseDownloadFormat(request: Request) {
  const value = new URL(request.url).searchParams.get("format") ?? "json";

  return value === "json" || value === "csv" ? value : null;
}

export const GET = withRoute(
  { access: "admin", action: "download API connection outputs" },
  async (
    _identity,
    request: Request,
    context: ApiConnectionRunDownloadContext,
  ) => {
    const format = parseDownloadFormat(request);

    if (!format) {
      return jsonError("Output format must be json or csv.");
    }

    const { connectionId, runId } = await context.params;

    try {
      const download = await getApiConnectionRunOutputDownload({
        connectionId,
        runId,
        format,
      });

      if (!download) {
        return jsonError("API connection run output not found.", 404);
      }

      return new Response(download.body, {
        status: 200,
        headers: {
          "Content-Type": download.contentType,
          "Content-Disposition": `attachment; filename="${download.fileName}"`,
        },
      });
    } catch (error) {
      logError("Failed to download API connection run output", error);
      return jsonError(
        "Could not download the API connection run output.",
        502,
      );
    }
  },
);
