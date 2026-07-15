import { after } from "next/server";

import {
  PartnerExportError,
  executePartnerExportRun,
  startPartnerExportRun,
} from "@/lib/partner-exports";
import { partnerExportRunInputSchema } from "@/lib/partner-exports/schemas";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = {
  params: Promise<{ datasetId: string; profileId: string }>;
};

export const POST = withRoute(
  { access: "admin", action: "generate partner exports" },
  async (identity, request: Request, context: Context) => {
    const parsed = partnerExportRunInputSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return jsonError("Partner export run payload is invalid.");
    }

    const { datasetId, profileId } = await context.params;
    try {
      const run = await startPartnerExportRun({
        datasetId,
        profileId,
        identity,
        warningsAcknowledged: parsed.data.warningsAcknowledged,
      });
      if (!run) {
        return jsonError("Partner export profile not found.", 404);
      }

      after(async () => {
        await executePartnerExportRun({ runId: run.id });
      });
      return Response.json({ run }, { status: 202 });
    } catch (error) {
      if (error instanceof PartnerExportError) {
        return jsonError(error.message, error.status);
      }
      logError("Failed to start partner export run", error);
      return jsonError("Could not start partner export run.", 500);
    }
  },
);
