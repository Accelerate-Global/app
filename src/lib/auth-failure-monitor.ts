import { createHmac } from "node:crypto";

import { logError } from "@/lib/error-logging";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const AUTH_FAILURE_WINDOW_MINUTES = 15;
const AUTH_FAILURE_THRESHOLD = 5;

type AuthFailureRpcResult = {
  recorded?: unknown;
  should_alert?: unknown;
  failure_count?: unknown;
  window_id?: unknown;
};

function getHashSecret() {
  const secret = process.env.AUTH_FAILURE_HASH_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_FAILURE_HASH_SECRET must contain at least 32 characters.");
  }

  return secret;
}

export function hashAuthFailureSubject(email: string) {
  return createHmac("sha256", getHashSecret())
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}

export async function recordInvalidCredentialFailure(email: string) {
  try {
    const subjectHash = hashAuthFailureSubject(email);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("record_auth_failure", {
      p_subject_hash: subjectHash,
      p_window_minutes: AUTH_FAILURE_WINDOW_MINUTES,
      p_threshold: AUTH_FAILURE_THRESHOLD,
    });

    if (error) throw error;

    const result = (data ?? {}) as AuthFailureRpcResult;
    const shouldAlert = result.should_alert === true;
    const failureCount =
      typeof result.failure_count === "number" ? result.failure_count : 0;
    const windowId =
      typeof result.window_id === "string" ? result.window_id : null;

    if (shouldAlert && windowId) {
      await captureOperationalEvent({
        kind: "auth-repeated-failures",
        windowId,
        occurrenceCount: failureCount,
      });
    }

    return {
      recorded: result.recorded === true,
      shouldAlert,
      failureCount,
      windowId,
    };
  } catch (error) {
    logError("Failed to record invalid credential attempt", error);
    return {
      recorded: false,
      shouldAlert: false,
      failureCount: 0,
      windowId: null,
    };
  }
}

export async function resetInvalidCredentialFailures(email: string) {
  try {
    const subjectHash = hashAuthFailureSubject(email);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("reset_auth_failures", {
      p_subject_hash: subjectHash,
    });

    if (error) throw error;
  } catch (error) {
    logError("Failed to reset invalid credential attempts", error);
  }
}
