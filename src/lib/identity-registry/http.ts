import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";

import { AxIdentityRegistryError } from "./service";

export function identityRegistryRouteError(
  label: string,
  fallback: string,
  error: unknown,
) {
  if (error instanceof AxIdentityRegistryError) {
    return jsonError(error.message, error.status);
  }
  logError(label, error);
  return jsonError(fallback, 500);
}
