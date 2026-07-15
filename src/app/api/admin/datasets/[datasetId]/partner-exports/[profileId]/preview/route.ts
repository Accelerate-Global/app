import {
  PartnerExportError,
  previewPartnerExportProfile,
} from "@/lib/partner-exports";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = {
  params: Promise<{ datasetId: string; profileId: string }>;
};

export const POST = withRoute(
  { access: "admin", action: "preview partner exports" },
  async (_identity, _request: Request, context: Context) => {
    const { datasetId, profileId } = await context.params;
    try {
      const result = await previewPartnerExportProfile({ datasetId, profileId });
      return result
        ? Response.json({ preview: result.preview })
        : jsonError("Partner export profile not found.", 404);
    } catch (error) {
      if (error instanceof PartnerExportError) {
        return jsonError(error.message, error.status);
      }
      logError("Failed to preview partner export", error);
      return jsonError("Could not preview partner export.", 500);
    }
  },
);
