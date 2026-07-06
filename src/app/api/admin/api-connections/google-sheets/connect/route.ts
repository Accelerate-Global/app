import { z } from "zod";

import {
  ApiConnectionError,
  createGoogleSheetsConnections,
} from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { GoogleSheetsError } from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

const googleSheetsConnectSchema = z.object({
  spreadsheetUrl: z.string().trim().min(1).max(2048),
  selectedSheetIds: z.array(z.number().int().nonnegative()).min(1).max(50),
  datasetClassification: z.enum(["PGAC", "PGIC"]).default("PGAC"),
});

export const POST = withRoute(
  { access: "admin", action: "connect Google Sheets" },
  async (identity, request: Request) => {
    const body = await request.json().catch(() => null);
    const parsed = googleSheetsConnectSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Google Sheets connection request is invalid.");
    }

    try {
      const connections = await createGoogleSheetsConnections({
        identity,
        spreadsheetUrl: parsed.data.spreadsheetUrl,
        selectedSheetIds: parsed.data.selectedSheetIds,
        datasetClassification: parsed.data.datasetClassification,
      });

      return Response.json({ connections }, { status: 201 });
    } catch (error) {
      if (error instanceof ApiConnectionError) {
        return jsonError(error.message, error.status);
      }

      if (error instanceof GoogleSheetsError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to create Google Sheets connections", error);
      return jsonError("Could not create Google Sheets connections.", 500);
    }
  },
);
