import { getCurrentIdentity } from "@/lib/auth";
import {
  DatasetVersionRevertConflictError,
  revertDatasetVersion,
} from "@/lib/datasets";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

type DatasetVersionRevertContext = {
  params: Promise<{
    datasetId: string;
    versionId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: DatasetVersionRevertContext,
) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("revert dataset upload history");
  }

  const { datasetId, versionId } = await context.params;
  let reverted;

  try {
    reverted = await revertDatasetVersion({
      datasetId,
      versionId,
      actorOwnerId: identity.ownerId,
      actorEmail: identity.email,
    });
  } catch (error) {
    if (error instanceof DatasetVersionRevertConflictError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  if (!reverted) {
    return jsonError("Dataset version not found.", 404);
  }

  return Response.json({ dataset: reverted.dataset });
}
