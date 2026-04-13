import { getCurrentIdentity } from "@/lib/auth";
import { createDataset, listDatasets } from "@/lib/datasets";
import { isDatasetStoragePath } from "@/lib/dataset-storage";
import { jsonError } from "@/lib/http";
import { createDatasetSchema } from "@/lib/validation";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const datasets = await listDatasets();
  return Response.json({ datasets });
}

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can upload CSV files.", 403);
  }

  const parsed = createDatasetSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Dataset payload is invalid.");
  }

  if (!isDatasetStoragePath(parsed.data.blobPath)) {
    return jsonError("Dataset storage path is invalid.", 403);
  }

  const dataset = await createDataset({
    ownerId: identity.ownerId,
    ...parsed.data,
  });

  return Response.json({ dataset }, { status: 201 });
}
