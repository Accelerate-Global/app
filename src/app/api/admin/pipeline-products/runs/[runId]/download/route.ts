import { downloadPipelineRunArtifact, PipelineProductError } from "@/lib/pipeline-products";
import { pipelineArtifactKindSchema } from "@/lib/pipeline-products/validation";
import { logError } from "@/lib/error-logging";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type Context = { params: Promise<{ runId: string }> };

export const GET = withRoute(
  { access: "admin", action: "download pipeline evidence" },
  async (_identity, request: Request, context: Context) => {
    const parsed = pipelineArtifactKindSchema.safeParse(new URL(request.url).searchParams.get("kind"));
    if (!parsed.success) return jsonError("Pipeline artifact kind is invalid.", 400);
    try {
      const artifact = await downloadPipelineRunArtifact((await context.params).runId, parsed.data);
      return new Response(artifact.body, {
        headers: {
          "Content-Type": artifact.contentType,
          "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
        },
      });
    } catch (error) {
      if (error instanceof PipelineProductError) return jsonError(error.message, error.status);
      logError("Failed to download pipeline artifact", error);
      return jsonError("Could not download the pipeline artifact.", 500);
    }
  },
);
