import { z } from "zod";

import { startGoogleSheetsConnectionOAuth } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { GoogleSheetsError } from "@/lib/google-sheets";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

const googleSheetsOAuthStartSchema = z.object({
  spreadsheetUrl: z.string().trim().min(1).max(2048),
});

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("connect Google Sheets");
  }

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
}
