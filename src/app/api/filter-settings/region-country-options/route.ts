import { getCurrentIdentity } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { listRegionCountryOptions } from "@/lib/filter-settings";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can manage filter settings.", 403);
  }

  const countries = await listRegionCountryOptions();
  return Response.json({ countries });
}
