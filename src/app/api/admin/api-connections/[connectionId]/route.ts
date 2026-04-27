import {
  ApiConnectionError,
  deleteApiConnection,
  updateApiConnection,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { apiConnectionUpdateSchema } from "@/lib/validation";

type ApiConnectionContext = {
  params: Promise<{
    connectionId: string;
  }>;
};

export async function PATCH(request: Request, context: ApiConnectionContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage API connections");
  }

  const parsed = apiConnectionUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("API connection payload is invalid.");
  }

  const { connectionId } = await context.params;

  try {
    const connection = await updateApiConnection({
      connectionId,
      actorOwnerId: identity.ownerId,
      connection: parsed.data,
    });

    if (!connection) {
      return jsonError("API connection not found.", 404);
    }

    return Response.json({ connection });
  } catch (error) {
    if (error instanceof ApiConnectionError) {
      return jsonError(error.message, error.status);
    }

    logError("Failed to update API connection", error);
    return jsonError("Could not update the API connection.", 500);
  }
}

export async function DELETE(_request: Request, context: ApiConnectionContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage API connections");
  }

  const { connectionId } = await context.params;

  try {
    const connection = await deleteApiConnection(connectionId);

    if (!connection) {
      return jsonError("API connection not found.", 404);
    }

    return Response.json({ connection });
  } catch (error) {
    logError("Failed to delete API connection", error);
    return jsonError("Could not delete the API connection.", 500);
  }
}
