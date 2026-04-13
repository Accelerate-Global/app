import { del } from "@vercel/blob";

import { getCurrentOwnerId } from "@/lib/auth";
import {
  deleteDatasetForOwner,
  getDatasetForOwner,
  updateDatasetStatus,
} from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { datasetPatchSchema } from "@/lib/validation";

type DatasetContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function GET(_request: Request, context: DatasetContext) {
  const ownerId = await getCurrentOwnerId();

  if (!ownerId) {
    return jsonError("Unauthorized.", 401);
  }

  const { datasetId } = await context.params;
  const dataset = await getDatasetForOwner(datasetId, ownerId);

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ dataset });
}

export async function PATCH(request: Request, context: DatasetContext) {
  const ownerId = await getCurrentOwnerId();

  if (!ownerId) {
    return jsonError("Unauthorized.", 401);
  }

  const { datasetId } = await context.params;
  const parsed = datasetPatchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Dataset status payload is invalid.");
  }

  const dataset = await updateDatasetStatus({
    datasetId,
    ownerId,
    status: parsed.data.status,
    error: parsed.data.error,
  });

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ dataset });
}

export async function DELETE(_request: Request, context: DatasetContext) {
  const ownerId = await getCurrentOwnerId();

  if (!ownerId) {
    return jsonError("Unauthorized.", 401);
  }

  const { datasetId } = await context.params;
  const dataset = await deleteDatasetForOwner(datasetId, ownerId);

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const isLocalDevBlob = dataset.blobUrl.includes("/api/blob/local/");

  if (blobToken && !isLocalDevBlob) {
    try {
      await del(dataset.blobUrl, { token: blobToken });
    } catch (error) {
      console.error("Failed to delete blob", error);
    }
  }

  return Response.json({ dataset });
}
