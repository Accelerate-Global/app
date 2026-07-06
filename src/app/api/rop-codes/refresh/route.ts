import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { refreshRopCodeResourceFromHis } from "@/lib/rop-codes";

export function GET() {
  return Response.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export const POST = withRoute(
  { access: "admin", action: "refresh ROP codes" },
  async () => {
    try {
      return Response.json(await refreshRopCodeResourceFromHis());
    } catch (error) {
      logError("Failed to refresh ROP codes", error);
      return jsonError("Could not refresh ROP codes.", 502);
    }
  },
);
