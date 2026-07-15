import {
  PartnerExportError,
  createPartnerExportProfile,
  listPartnerExports,
} from "@/lib/partner-exports";
import { partnerExportProfileInputSchema } from "@/lib/partner-exports/schemas";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ datasetId: string }> };

export const GET = withRoute(
  { access: "admin", action: "view partner exports" },
  async (_identity, _request: Request, context: Context) => {
    const { datasetId } = await context.params;
    const result = await listPartnerExports(datasetId);
    return result ? Response.json(result) : jsonError("Dataset not found.", 404);
  },
);

export const POST = withRoute(
  { access: "admin", action: "create partner export profiles" },
  async (identity, request: Request, context: Context) => {
    const parsed = partnerExportProfileInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError("Partner export profile payload is invalid.");
    }

    const { datasetId } = await context.params;
    try {
      const profile = await createPartnerExportProfile({
        datasetId,
        identity,
        profile: parsed.data,
      });
      return profile
        ? Response.json({ profile }, { status: 201 })
        : jsonError("Dataset not found.", 404);
    } catch (error) {
      if (error instanceof PartnerExportError) {
        return jsonError(error.message, error.status);
      }
      logError("Failed to create partner export profile", error);
      return jsonError("Could not create partner export profile.", 500);
    }
  },
);
