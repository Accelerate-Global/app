import { getCurrentIdentity } from "@/lib/auth";
import { replaceDatasetContents } from "@/lib/datasets";
import { isDatasetStoragePath } from "@/lib/dataset-storage";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { replaceDatasetSchema } from "@/lib/validation";

type DatasetContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function POST(request: Request, context: DatasetContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("replace datasets");
  }

  const parsed = replaceDatasetSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Dataset replacement payload is invalid.");
  }

  if (!isDatasetStoragePath(parsed.data.blobPath)) {
    return jsonError("Dataset storage path is invalid.", 403);
  }

  const { datasetId } = await context.params;
  const replacement = await replaceDatasetContents({
    datasetId,
    actorOwnerId: identity.ownerId,
    actorEmail: identity.email,
    ...parsed.data,
  });

  if (!replacement) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ dataset: replacement.dataset });
}
