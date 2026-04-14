import { getCurrentIdentity } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { reorderDatasets } from "@/lib/datasets";
import { datasetReorderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can reorder datasets.", 403);
  }

  const parsed = datasetReorderSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Dataset order payload is invalid.");
  }

  const datasets = await reorderDatasets(parsed.data.datasetIds);

  if (!datasets) {
    return jsonError("One or more datasets could not be reordered.", 404);
  }

  return Response.json({ datasets });
}
