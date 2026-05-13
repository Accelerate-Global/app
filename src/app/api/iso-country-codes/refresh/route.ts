import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import {
  mergeIsoCountryCodeEntryOverrides,
  refreshIsoCountryCodeResourceFromOfficialSource,
} from "@/lib/iso-country-codes";

export function GET() {
  return Response.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("refresh country and territory codes");
  }

  try {
    const resource = await refreshIsoCountryCodeResourceFromOfficialSource();
    return Response.json(await mergeIsoCountryCodeEntryOverrides(resource));
  } catch (error) {
    logError("Failed to refresh country and territory codes", error);
    return jsonError("Could not refresh country and territory codes.", 502);
  }
}
