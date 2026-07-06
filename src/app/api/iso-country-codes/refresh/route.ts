import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
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

export const POST = withRoute(
  { access: "admin", action: "refresh country and territory codes" },
  async () => {
    try {
      const resource = await refreshIsoCountryCodeResourceFromOfficialSource();
      return Response.json(await mergeIsoCountryCodeEntryOverrides(resource));
    } catch (error) {
      logError("Failed to refresh country and territory codes", error);
      return jsonError("Could not refresh country and territory codes.", 502);
    }
  },
);
