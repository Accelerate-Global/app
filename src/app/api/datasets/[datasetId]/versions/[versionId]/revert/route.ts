import {
  DerivedDatasetMutationError,
  DatasetVersionRevertConflictError,
  revertDatasetVersion,
} from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type DatasetVersionRevertContext = {
  params: Promise<{
    datasetId: string;
    versionId: string;
  }>;
};

export const POST = withRoute(
  { access: "admin", action: "revert dataset upload history" },
  async (identity, _request: Request, context: DatasetVersionRevertContext) => {
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
      if (
        error instanceof DatasetVersionRevertConflictError ||
        error instanceof DerivedDatasetMutationError
      ) {
        return jsonError(error.message, error.status);
      }

      throw error;
    }

    if (!reverted) {
      return jsonError("Dataset version not found.", 404);
    }

    return Response.json({ dataset: reverted.dataset });
  },
);
