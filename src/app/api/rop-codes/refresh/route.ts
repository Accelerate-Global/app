import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { refreshRopCodeResourceFromHis } from "@/lib/rop-codes";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("refresh ROP codes");
  }

  try {
    return Response.json(await refreshRopCodeResourceFromHis());
  } catch (error) {
    logError("Failed to refresh ROP codes", error);
    return jsonError("Could not refresh ROP codes.", 502);
  }
}
