import { getCurrentIdentity } from "@/lib/auth";
import {
  assignDatasetDerivedView,
  DerivedDatasetSourceConflictError,
} from "@/lib/datasets";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { datasetAssignDerivedViewSchema } from "@/lib/validation";

type DatasetAssignDerivedViewContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function POST(
  request: Request,
  context: DatasetAssignDerivedViewContext,
) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("assign filtered datasets");
  }

  const parsed = datasetAssignDerivedViewSchema.safeParse(await request.json());

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
    if (error instanceof DerivedDatasetSourceConflictError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }
}
