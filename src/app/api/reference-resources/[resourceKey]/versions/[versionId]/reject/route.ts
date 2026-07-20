import { z } from "zod";

import { jsonError } from "@/lib/http";
import {
  rejectReferenceResourceVersion,
  ReferenceResourceValidationError,
} from "@/lib/reference-resources";
import { isReferenceResourceKey } from "@/lib/reference-resources/types";
import { withRoute } from "@/lib/route-guard";

const schema = z.object({ reason: z.string().trim().min(3).max(500) });
type Context = { params: Promise<{ resourceKey: string; versionId: string }> };

export const POST = withRoute(
  { access: "admin", action: "reject reference resource candidates" },
  async (identity, request: Request, context: Context) => {
    const { resourceKey, versionId } = await context.params;
    if (!isReferenceResourceKey(resourceKey)) return jsonError("Reference resource not found.", 404);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Rejection payload is invalid.");
    try {
      return Response.json({
        version: await rejectReferenceResourceVersion({
          resourceKey,
          versionId,
          actorOwnerId: identity.ownerId,
          reason: parsed.data.reason,
        }),
      });
    } catch (error) {
      if (error instanceof ReferenceResourceValidationError) return jsonError(error.message, 400);
      throw error;
    }
  },
);
