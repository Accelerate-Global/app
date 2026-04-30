import { getCurrentIdentity } from "@/lib/auth";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

export async function PATCH(request: Request) {
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

export async function DELETE() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage API connections");
  }

  return jsonError("API connection profiles are managed from the codebase.", 405);
}
