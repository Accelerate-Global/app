import { getCurrentIdentity } from "@/lib/auth";
import {
  DatasetClassificationError,
  DatasetDeleteConflictError,
  DerivedDatasetMutationError,
  deleteDataset,
  getDataset,
  updateDatasetDetails,
  updateDatasetStatus,
} from "@/lib/datasets";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { getDatasetStorageBucket } from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logging";
import { datasetPatchSchema } from "@/lib/validation";

type DatasetContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function GET(_request: Request, context: DatasetContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const { datasetId } = await context.params;
  const dataset = await getDataset(datasetId, {
    includeDisabled: identity.isDatasetAdmin,
  });

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ dataset });
}

export async function PATCH(request: Request, context: DatasetContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("modify datasets");
  }

  const { datasetId } = await context.params;
  const parsed = datasetPatchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Dataset update payload is invalid.");
  }

  let dataset;

  try {
    dataset =
      "status" in parsed.data
        ? await updateDatasetStatus({
            datasetId,
            status: parsed.data.status,
            error: parsed.data.error,
          })
        : await updateDatasetDetails({
            datasetId,
            fileName: parsed.data.fileName,
            sourceOrganizationName: parsed.data.sourceOrganizationName,
            tags: parsed.data.tags,
            isPrimary: parsed.data.isPrimary,
            isPublic: parsed.data.isPublic,
            hiddenColumnKeys: parsed.data.hiddenColumnKeys,
          });
  } catch (error) {
    if (
      error instanceof DatasetClassificationError ||
      error instanceof DerivedDatasetMutationError
    ) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ dataset });
}

export async function DELETE(_request: Request, context: DatasetContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("delete datasets");
  }

  const { datasetId } = await context.params;
  let deleted;

  try {
    deleted = await deleteDataset(datasetId);
  } catch (error) {
    if (error instanceof DatasetDeleteConflictError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  if (!deleted) {
    return jsonError("Dataset not found.", 404);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const deletion = await supabase.storage
      .from(getDatasetStorageBucket())
      .remove(deleted.blobPaths);

    if (deletion.error) {
      logError("Failed to delete dataset file from Supabase Storage", deletion.error);
    }
  } catch (error) {
    logError("Failed to delete dataset file from Supabase Storage", error);
  }

  return Response.json({ dataset: deleted.dataset });
}
