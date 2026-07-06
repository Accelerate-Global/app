import { z } from "zod";

import { startGoogleSheetsConnectionOAuth } from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { GoogleSheetsError } from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

const googleSheetsOAuthStartSchema = z.object({
  spreadsheetUrl: z.string().trim().min(1).max(2048),
});

export const POST = withRoute(
  { access: "admin", action: "connect Google Sheets" },
  async (identity, request: Request) => {
    const parsed = googleSheetsOAuthStartSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("Google Sheet URL is required.");
    }

    try {
      const result = await startGoogleSheetsConnectionOAuth({
        identity,
        spreadsheetUrl: parsed.data.spreadsheetUrl,
        requestUrl: request.url,
      });

      return Response.json({ authorizationUrl: result.authorizationUrl });
    } catch (error) {
      if (error instanceof GoogleSheetsError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to start Google Sheets OAuth", error);
      return jsonError("Could not start Google Sheets connection.", 500);
    }
  },
);
