import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { updateIsoCountryCodeAlternativeNames } from "@/lib/iso-country-codes";
import { isoCountryCodeAlternativeNamesPatchSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("manage country and territory alternate names");
  }

  const body = await request.json().catch(() => null);
  const parsed = isoCountryCodeAlternativeNamesPatchSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Alternate-name payload is invalid.");
  }

  try {
    const result = await updateIsoCountryCodeAlternativeNames({
      displayName: parsed.data.displayName,
      alternativeNames: parsed.data.alternativeNames,
      updatedByOwnerId: identity.ownerId,
    });

    if (!result) {
      return jsonError("Country or territory not found.", 404);
    }

    return Response.json(result);
  } catch (error) {
    logError("Failed to update country-code alternate names", error);
    return jsonError("Could not update alternate names.", 500);
  }
}
