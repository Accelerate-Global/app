import { z } from "zod";

import { downloadAxIdentityCandidateArtifact } from "@/lib/identity-registry";
import { identityRegistryRouteError } from "@/lib/identity-registry/http";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };
const kindSchema = z.enum(["rows", "findings", "manifest", "csv"]);

export const GET = withRoute(
  { access: "admin", action: "download AX identity candidate artifacts" },
  async (_identity, request: Request, context: Context) => {
    const parsed = kindSchema.safeParse(new URL(request.url).searchParams.get("kind"));
    if (!parsed.success) return jsonError("Identity artifact kind is invalid.");
    try {
      const { runId } = await context.params;
      const body = await downloadAxIdentityCandidateArtifact({ runId, kind: parsed.data });
      return new Response(body, {
        headers: {
          "Content-Type": parsed.data === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="ax-identity-${runId}-${parsed.data}.${parsed.data === "csv" ? "csv" : "json"}"`,
        },
      });
    } catch (error) {
      return identityRegistryRouteError(
        "Failed to download AX identity candidate artifact",
        "Could not download the AX identity candidate artifact.",
        error,
      );
    }
  },
);
