import {
  PartnerExportError,
  archivePartnerExportProfile,
  updatePartnerExportProfile,
} from "@/lib/partner-exports";
import { partnerExportProfileInputSchema } from "@/lib/partner-exports/schemas";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = {
  params: Promise<{ datasetId: string; profileId: string }>;
};

export const PATCH = withRoute(
  { access: "admin", action: "update partner export profiles" },
  async (identity, request: Request, context: Context) => {
    const parsed = partnerExportProfileInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError("Partner export profile payload is invalid.");
    }

    const { datasetId, profileId } = await context.params;
    try {
      const profile = await updatePartnerExportProfile({
        datasetId,
        profileId,
        identity,
        profile: parsed.data,
      });
      return profile
        ? Response.json({ profile })
        : jsonError("Partner export profile not found.", 404);
    } catch (error) {
      if (error instanceof PartnerExportError) {
        return jsonError(error.message, error.status);
      }
      logError("Failed to update partner export profile", error);
      return jsonError("Could not update partner export profile.", 500);
    }
  },
);

export const DELETE = withRoute(
  { access: "admin", action: "archive partner export profiles" },
  async (identity, _request: Request, context: Context) => {
    const { datasetId, profileId } = await context.params;
    try {
      const profile = await archivePartnerExportProfile({
        datasetId,
        profileId,
        identity,
      });
      return profile
        ? Response.json({ profile })
        : jsonError("Partner export profile not found.", 404);
    } catch (error) {
      logError("Failed to archive partner export profile", error);
      return jsonError("Could not archive partner export profile.", 500);
    }
  },
);
