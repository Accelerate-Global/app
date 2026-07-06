import {
  ApiConnectionError,
  checkGoogleSheetsConnectionAccess,
  disconnectGoogleSheetsConnection,
} from "@/lib/api-connections";
import { logError } from "@/lib/error-logging";
import { GoogleSheetsError } from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type GoogleSheetsConnectionContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

export const GET = withRoute(
  { access: "admin", action: "check Google Sheets access" },
  async (
    identity,
    _request: Request,
    context: GoogleSheetsConnectionContext,
  ) => {
    const { connectionId } = await context.params;

    try {
      const result = await checkGoogleSheetsConnectionAccess({
        connectionId,
        identity,
      });

      if (!result) {
        return jsonError("Google Sheets connection not found.", 404);
      }

      return Response.json(result);
    } catch (error) {
      if (error instanceof ApiConnectionError) {
        return jsonError(error.message, error.status);
      }

      if (error instanceof GoogleSheetsError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to check Google Sheets connection access", error);
      return jsonError("Could not check Google Sheets connection access.", 500);
    }
  },
);

export const DELETE = withRoute(
  { access: "admin", action: "disconnect Google Sheets" },
  async (
    identity,
    _request: Request,
    context: GoogleSheetsConnectionContext,
  ) => {
    const { connectionId } = await context.params;

    try {
      const connection = await disconnectGoogleSheetsConnection({
        connectionId,
        identity,
      });

      if (!connection) {
        return jsonError("Google Sheets connection not found.", 404);
      }

      return Response.json({ connection });
    } catch (error) {
      if (error instanceof ApiConnectionError) {
        return jsonError(error.message, error.status);
      }

      logError("Failed to disconnect Google Sheets connection", error);
      return jsonError("Could not disconnect Google Sheets connection.", 500);
    }
  },
);
