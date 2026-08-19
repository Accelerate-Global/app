import { logError } from "@/lib/error-logging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OperationalAlertSeverity = "critical" | "high" | "medium" | "info";

export type OperationalAlertInput = {
  idempotencyKey: string;
  fingerprint: string;
  severity: OperationalAlertSeverity;
  source: string;
  title: string;
  summary: string;
  detailsUrl?: string;
  occurrenceCount?: number;
};

type OperationalAlertEnqueueResult =
  | { queued: true; notificationId?: string }
  | { queued: false };

type OperationalAlertRpcResult = {
  data: unknown;
  error: unknown;
};

export async function enqueueOperationalAlert(
  input: OperationalAlertInput,
): Promise<OperationalAlertEnqueueResult> {
  try {
    const supabase = createSupabaseAdminClient();
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      functionName: string,
      parameters: Record<string, unknown>,
    ) => Promise<OperationalAlertRpcResult>;
    const { data, error } = await rpc("enqueue_operational_alert", {
      p_idempotency_key: input.idempotencyKey,
      p_fingerprint: input.fingerprint,
      p_severity: input.severity,
      p_source: input.source,
      p_title: input.title,
      p_summary: input.summary,
      p_details_url: input.detailsUrl ?? null,
      p_occurrence_count: input.occurrenceCount ?? 1,
    });

    if (error) {
      throw error;
    }

    return {
      queued: true,
      notificationId: typeof data === "string" ? data : undefined,
    };
  } catch (error) {
    logError("Operational alert enqueue failed", error);
    return { queued: false };
  }
}
