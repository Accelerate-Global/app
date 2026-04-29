import { getCurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { upsertAnalyticsFailureTriage } from "@/lib/analytics-store";
import { analyticsFailureTriagePatchSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("triage analytics failures");
  }

  const parsed = analyticsFailureTriagePatchSchema.safeParse(await request.json());

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
}
