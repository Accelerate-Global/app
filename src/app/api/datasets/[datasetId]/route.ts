import { getCurrentIdentity } from "@/lib/auth";
import {
  deleteDataset,
  getDataset,
  updateDatasetDetails,
  updateDatasetStatus,
} from "@/lib/datasets";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { getDatasetStorageBucket } from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
  const dataset = await getDataset(datasetId);

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

  const dataset =
    "status" in parsed.data
      ? await updateDatasetStatus({
          datasetId,
          status: parsed.data.status,
          error: parsed.data.error,
        })
      : await updateDatasetDetails({
          datasetId,
          fileName: parsed.data.fileName,
          tags: parsed.data.tags,
          isPrimary: parsed.data.isPrimary,
          hiddenColumnKeys: parsed.data.hiddenColumnKeys,
        });

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
  const dataset = await deleteDataset(datasetId);

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const deletion = await supabase.storage
      .from(getDatasetStorageBucket())
      .remove([dataset.blobPath]);

    if (deletion.error) {
      console.error("Failed to delete dataset file from Supabase Storage", deletion.error);
    }
  } catch (error) {
    console.error("Failed to delete dataset file from Supabase Storage", error);
  }

  return Response.json({ dataset });
}
