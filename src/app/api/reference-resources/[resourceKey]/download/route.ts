import { jsonError } from "@/lib/http";
import {
  createReferenceResourceCsvStream,
  getActiveReferenceResourceVersion,
  ReferenceResourceNotFoundError,
} from "@/lib/reference-resources";
import { isReferenceResourceKey } from "@/lib/reference-resources/types";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ resourceKey: string }> };

export const GET = withRoute(
  { access: "user" },
  async (_identity, request: Request, context: Context) => {
    const { resourceKey } = await context.params;
    if (!isReferenceResourceKey(resourceKey)) return jsonError("Reference resource not found.", 404);
    try {
      await getActiveReferenceResourceVersion(resourceKey);
      const csv = createReferenceResourceCsvStream({
        resourceKey,
        search: new URL(request.url).searchParams.get("search") ?? undefined,
      });
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${resourceKey}.csv"`,
        },
      });
    } catch (error) {
      if (error instanceof ReferenceResourceNotFoundError) return jsonError(error.message, 404);
      throw error;
    }
  },
);
