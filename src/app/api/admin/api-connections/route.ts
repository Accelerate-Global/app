import { listApiConnections } from "@/lib/api-connections";
import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

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

  await request.body?.cancel();
  return jsonError("API connection profiles are managed from the codebase.", 405);
}
