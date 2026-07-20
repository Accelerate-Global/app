import { jsonError } from "@/lib/http";
import {
  listReferenceResourceFindings,
  ReferenceResourceNotFoundError,
} from "@/lib/reference-resources";
import { isReferenceResourceKey } from "@/lib/reference-resources/types";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ resourceKey: string; versionId: string }> };

export const GET = withRoute(
  { access: "admin", action: "read reference resource validation findings" },
  async (_identity, _request: Request, context: Context) => {
    const { resourceKey, versionId } = await context.params;
    if (!isReferenceResourceKey(resourceKey)) {
      return jsonError("Reference resource not found.", 404);
    }
    try {
      return Response.json({
        findings: await listReferenceResourceFindings({ resourceKey, versionId }),
      });
    } catch (error) {
      if (error instanceof ReferenceResourceNotFoundError) {
        return jsonError(error.message, 404);
      }
      throw error;
    }
  },
);
