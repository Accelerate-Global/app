import { z } from "zod";

import {
  ApiConnectionError,
  previewGoogleSheetsConnection,
} from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import {
  GoogleSheetsError,
  getGoogleSheetsServiceAccountEmail,
} from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

const googleSheetsCheckAccessSchema = z.object({
  spreadsheetUrl: z.string().trim().min(1).max(2048),
});

export const GET = withRoute(
  { access: "admin", action: "connect Google Sheets" },
  async () => {
    try {
      return Response.json({
        configured: true,
        serviceAccountEmail: getGoogleSheetsServiceAccountEmail(),
      });
    } catch (error) {
      if (error instanceof GoogleSheetsError) {
        return Response.json({
          configured: false,
          serviceAccountEmail: null,
        });
      }

      logError("Failed to read Google Sheets service account status", error);
      return jsonError("Could not load Google Sheets service account status.", 500);
    }
  },
);

export const POST = withRoute(
  { access: "admin", action: "connect Google Sheets" },
  async (identity, request: Request) => {
    const body = await request.json().catch(() => null);
    const parsed = googleSheetsCheckAccessSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Google Sheet URL is required.");
    }

    try {
      const result = await previewGoogleSheetsConnection({
        identity,
        spreadsheetUrl: parsed.data.spreadsheetUrl,
      });

      return Response.json(result);
    } catch (error) {
      if (error instanceof ApiConnectionError) {
        return jsonError(error.message, error.status);
      }

      if (error instanceof GoogleSheetsError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to check Google Sheets service account access", error);
      return jsonError("Could not check Google Sheets access.", 500);
    }
  },
);
