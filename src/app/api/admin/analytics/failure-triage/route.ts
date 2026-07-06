import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { upsertAnalyticsFailureTriage } from "@/lib/analytics-store";
import { analyticsFailureTriagePatchSchema } from "@/lib/validation";

export const PATCH = withRoute(
  { access: "admin", action: "triage analytics failures" },
  async (identity, request: Request) => {
    const parsed = analyticsFailureTriagePatchSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      return jsonError("Analytics failure triage payload is invalid.");
    }

    try {
      const triage = await upsertAnalyticsFailureTriage({
        fingerprint: parsed.data.fingerprint,
        status: parsed.data.status,
        note: parsed.data.note,
        triagedByOwnerId: identity.ownerId,
      });

      return Response.json({ triage });
    } catch (error) {
      logError("Failed to update analytics failure triage", error);
      return jsonError("Could not update analytics failure triage.", 500);
    }
  },
);
