import { jsonError } from "@/lib/http";
import {
  getReferenceResourcePage,
  ReferenceResourceNotFoundError,
  ReferenceResourceValidationError,
} from "@/lib/reference-resources";
import { isReferenceResourceKey } from "@/lib/reference-resources/types";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ resourceKey: string }> };

export const GET = withRoute(
  { access: "user" },
  async (identity, request: Request, context: Context) => {
    const { resourceKey } = await context.params;
    if (!isReferenceResourceKey(resourceKey)) return jsonError("Reference resource not found.", 404);
    const url = new URL(request.url);
    const requestedVersion = url.searchParams.get("versionId") ?? undefined;
    if (requestedVersion && !identity.isDatasetAdmin) {
      return jsonError("Dataset admin access is required to read inactive versions.", 403);
    }
    try {
      return Response.json(
        await getReferenceResourcePage({
          resourceKey,
          search: url.searchParams.get("search") ?? undefined,
          cursor: url.searchParams.get("cursor"),
          limit: Number(url.searchParams.get("limit") ?? 100),
          versionId: requestedVersion,
        }),
      );
    } catch (error) {
      if (error instanceof ReferenceResourceNotFoundError) return jsonError(error.message, 404);
      if (error instanceof ReferenceResourceValidationError) return jsonError(error.message, 400);
      throw error;
    }
  },
);
