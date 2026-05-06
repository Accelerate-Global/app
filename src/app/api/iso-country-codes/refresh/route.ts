import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { refreshIsoCountryCodeResourceFromOfficialSource } from "@/lib/iso-country-codes";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const resource = await refreshIsoCountryCodeResourceFromOfficialSource();
    return Response.json(resource);
  } catch (error) {
    logError("Failed to refresh ISO country codes", error);
    return jsonError("Could not refresh ISO country codes from ISO.", 502);
  }
}
