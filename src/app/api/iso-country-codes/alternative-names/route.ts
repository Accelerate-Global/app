import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { deriveAndActivateCountryAliases } from "@/lib/reference-resources";
import { isoCountryCodeAlternativeNamesPatchSchema } from "@/lib/validation";

export const PATCH = withRoute(
  { access: "admin", action: "manage country and territory alternate names" },
  async (identity, request: Request) => {
    const body = await request.json().catch(() => null);
    const parsed = isoCountryCodeAlternativeNamesPatchSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Alternate-name payload is invalid.");
    }

    try {
      const result = await deriveAndActivateCountryAliases({
        displayName: parsed.data.displayName,
        alternativeNames: parsed.data.alternativeNames,
        actorOwnerId: identity.ownerId,
      });

      if (!result) {
        return jsonError("Country or territory not found.", 404);
      }

      return Response.json(result);
    } catch (error) {
      logError("Failed to update country-code alternate names", error);
      return jsonError("Could not update alternate names.", 500);
    }
  },
);
