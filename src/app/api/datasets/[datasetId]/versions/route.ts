import { getCurrentIdentity } from "@/lib/auth";
import { listDatasetVersions } from "@/lib/datasets";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";

type DatasetVersionsContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function GET(_request: Request, context: DatasetVersionsContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("read dataset upload history");
  }

  const { datasetId } = await context.params;
  const versions = await listDatasetVersions(datasetId);

  if (!versions) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ versions });
}
