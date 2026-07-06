import { getCurrentIdentity, type CurrentIdentity } from "@/lib/auth";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

export type RouteGuardOptions =
  | { access: "user" }
  | { access: "admin"; action: string };

/**
 * Owns the API route security invariant: identity resolution, the 401/403
 * gate, and last-resort error normalization. Handlers receive the resolved
 * identity and express only their domain action; payload validation and
 * domain-specific error mapping stay inside handlers.
 *
 * Every handler under `src/app/api/⋆⋆/route.ts` must be wrapped (enforced by
 * `route-guard-sweep.test.ts`); intentional exemptions are documented there.
 */
export function withRoute<Args extends unknown[]>(
  options: RouteGuardOptions,
  handler: (identity: CurrentIdentity, ...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      const identity = await getCurrentIdentity();

      if (!identity) {
        return jsonError("Unauthorized.", 401);
      }

      if (options.access === "admin" && !identity.isDatasetAdmin) {
        return jsonAdminOnlyError(options.action);
      }

      return await handler(identity, ...args);
    } catch (error) {
      logError("Unhandled API route error", error);
      return jsonError("Request failed.", 500);
    }
  };
}
