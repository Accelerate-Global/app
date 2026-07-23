import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";

import { Tier2ProductError } from "./errors";

export function tier2ProductRouteError(
  label: string,
  fallback: string,
  error: unknown,
) {
  if (error instanceof Tier2ProductError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }
  if (
    error instanceof Error && "status" in error &&
    typeof error.status === "number" && error.status >= 400 && error.status < 600
  ) {
    return jsonError(error.message, error.status);
  }
  logError(label, error);
  return jsonError(fallback, 500);
}
