import {
  assignDatasetDerivedView,
  DerivedDatasetSourceConflictError,
  PipelineManagedDatasetMutationError,
} from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { datasetAssignDerivedViewSchema } from "@/lib/validation";

type DatasetAssignDerivedViewContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export const POST = withRoute(
  { access: "admin", action: "assign filtered datasets" },
  async (
    _identity,
    request: Request,
    context: DatasetAssignDerivedViewContext,
  ) => {
    const parsed = datasetAssignDerivedViewSchema.safeParse(
      await request.json(),
    );

    if (!parsed.success) {
      return jsonError("Dataset assignment payload is invalid.");
    }

    const { datasetId } = await context.params;

    try {
      const dataset = await assignDatasetDerivedView({
        datasetId,
        sourceDatasetId: parsed.data.sourceDatasetId,
        filters: parsed.data.filters,
      });

      if (!dataset) {
        return jsonError("Dataset not found.", 404);
      }

      return Response.json({ dataset });
    } catch (error) {
      if (
        error instanceof DerivedDatasetSourceConflictError ||
        error instanceof PipelineManagedDatasetMutationError
      ) {
        return jsonError(error.message, error.status);
      }

      throw error;
    }
  },
);
