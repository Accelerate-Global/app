import { getCurrentIdentity } from "@/lib/auth";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { listRegionCountryOptions } from "@/lib/filter-settings";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage filter settings");
  }

  const countries = await listRegionCountryOptions();
  return Response.json({ countries });
}
