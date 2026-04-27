import {
  ApiConnectionError,
  createApiConnection,
  listApiConnections,
} from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { apiConnectionCreateSchema } from "@/lib/validation";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage API connections");
  }

  try {
    return Response.json(await listApiConnections());
  } catch (error) {
    logError("Failed to list API connections", error);
    return jsonError("Could not load API connections.", 500);
  }
}

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage API connections");
  }

  const parsed = apiConnectionCreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("API connection payload is invalid.");
  }

  try {
    const connection = await createApiConnection({
      actorOwnerId: identity.ownerId,
      connection: parsed.data,
    });

    return Response.json({ connection }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiConnectionError) {
      return jsonError(error.message, error.status);
    }

    logError("Failed to create API connection", error);
    return jsonError("Could not create the API connection.", 500);
  }
}
