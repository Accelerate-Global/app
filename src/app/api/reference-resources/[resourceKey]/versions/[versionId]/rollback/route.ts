import { z } from "zod";

import { jsonError } from "@/lib/http";
import {
  activateReferenceResource,
  ReferenceResourceConflictError,
  ReferenceResourceValidationError,
} from "@/lib/reference-resources";
import { isReferenceResourceKey } from "@/lib/reference-resources/types";
import { withRoute } from "@/lib/route-guard";

const schema = z.object({
  expectedActiveVersionId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});
type Context = { params: Promise<{ resourceKey: string; versionId: string }> };

export const POST = withRoute(
  { access: "admin", action: "roll back reference resource versions" },
  async (identity, request: Request, context: Context) => {
    const { resourceKey, versionId } = await context.params;
    if (!isReferenceResourceKey(resourceKey)) return jsonError("Reference resource not found.", 404);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Rollback payload is invalid.");
    try {
      const setId = await activateReferenceResource({
        resourceKey,
        versionId,
        expectedActiveVersionId: parsed.data.expectedActiveVersionId,
        actorOwnerId: identity.ownerId,
        reason: parsed.data.reason,
        action: "rollback",
      });
      return Response.json({ setId });
    } catch (error) {
      if (error instanceof ReferenceResourceConflictError) return jsonError(error.message, 409);
      if (error instanceof ReferenceResourceValidationError) return jsonError(error.message, 400);
      throw error;
    }
  },
);
