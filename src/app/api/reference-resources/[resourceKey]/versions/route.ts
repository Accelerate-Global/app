import { jsonError } from "@/lib/http";
import {
  listReferenceResourceActivationHistory,
  listReferenceResourceVersions,
} from "@/lib/reference-resources";
import { isReferenceResourceKey } from "@/lib/reference-resources/types";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ resourceKey: string }> };

export const GET = withRoute(
  { access: "admin", action: "read reference resource history" },
  async (_identity, _request: Request, context: Context) => {
    const { resourceKey } = await context.params;
    if (!isReferenceResourceKey(resourceKey)) return jsonError("Reference resource not found.", 404);
    const [versions, activationHistory] = await Promise.all([
      listReferenceResourceVersions(resourceKey),
      listReferenceResourceActivationHistory(resourceKey),
    ]);
    return Response.json({ versions, activationHistory });
  },
);
