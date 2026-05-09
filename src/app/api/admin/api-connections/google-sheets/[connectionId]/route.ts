import {
  ApiConnectionError,
  disconnectGoogleSheetsConnection,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

type GoogleSheetsConnectionContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: GoogleSheetsConnectionContext,
) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("disconnect Google Sheets");
  }

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
}
