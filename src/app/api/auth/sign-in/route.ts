import { randomUUID } from "node:crypto";

import {
  recordInvalidCredentialFailure,
  resetInvalidCredentialFailures,
} from "@/lib/auth-failure-monitor";
import { logError, normalizeErrorForLogging } from "@/lib/error-logging";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { passwordSignInSchema } from "@/lib/validation";

const GENERIC_INVALID_CREDENTIALS = "Invalid email or password.";
const GENERIC_SYSTEM_FAILURE =
  "Authentication is temporarily unavailable. Please try again.";

function jsonError(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isInvalidCredentialError(error: unknown) {
  const normalized = normalizeErrorForLogging(error);
  return normalized.code === "invalid_credentials";
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(GENERIC_INVALID_CREDENTIALS, 400);
  }

  const parsed = passwordSignInSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(GENERIC_INVALID_CREDENTIALS, 400);
  }

  const { email, password } = parsed.data;
  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (isInvalidCredentialError(error)) {
        await recordInvalidCredentialFailure(email);
        return jsonError(GENERIC_INVALID_CREDENTIALS, 401);
      }

      const normalized = normalizeErrorForLogging(error);
      logError("Supabase password sign-in failed", error);
      await captureOperationalEvent({
        kind: "auth-system-failed",
        occurrenceId: randomUUID(),
        reasonCode:
          typeof normalized.code === "string" ? normalized.code : "provider-error",
      });
      return jsonError(GENERIC_SYSTEM_FAILURE, 503);
    }

    await resetInvalidCredentialFailures(email);
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const normalized = normalizeErrorForLogging(error);
    logError("Password sign-in request failed", error);
    await captureOperationalEvent({
      kind: "auth-system-failed",
      occurrenceId: randomUUID(),
      reasonCode:
        typeof normalized.code === "string" ? normalized.code : "request-error",
    });
    return jsonError(GENERIC_SYSTEM_FAILURE, 503);
  }
}
