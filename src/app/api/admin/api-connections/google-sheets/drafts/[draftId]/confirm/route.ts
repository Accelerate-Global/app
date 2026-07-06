import { z } from "zod";

import {
  ApiConnectionError,
  confirmGoogleSheetsConnectionDraft,
} from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

const googleSheetsConfirmSchema = z.object({
  selectedSheetIds: z.array(z.number().int().nonnegative()).min(1).max(50),
  datasetClassification: z.enum(["PGAC", "PGIC"]).default("PGAC"),
});

type GoogleSheetsConfirmContext = {
  params: Promise<{
    draftId: string;
  }>;
};

export const POST = withRoute(
  { access: "admin", action: "connect Google Sheets" },
  async (identity, request: Request, context: GoogleSheetsConfirmContext) => {
    const parsed = googleSheetsConfirmSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("Google Sheets tab selection is invalid.");
    }

    const { draftId } = await context.params;

    try {
      const connections = await confirmGoogleSheetsConnectionDraft({
        identity,
        draftId,
        selectedSheetIds: parsed.data.selectedSheetIds,
        datasetClassification: parsed.data.datasetClassification,
      });

      return Response.json({ connections }, { status: 201 });
    } catch (error) {
      if (error instanceof ApiConnectionError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to confirm Google Sheets connection", error);
      return jsonError("Could not create Google Sheets connections.", 500);
    }
  },
);
