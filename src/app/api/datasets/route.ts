import { getCurrentOwnerId } from "@/lib/auth";
import { createDataset, listDatasets } from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { createDatasetSchema } from "@/lib/validation";

export async function GET() {
  const ownerId = await getCurrentOwnerId();

  if (!ownerId) {
    return jsonError("Unauthorized.", 401);
  }

  const datasets = await listDatasets(ownerId);
  return Response.json({ datasets });
}

export async function POST(request: Request) {
  const ownerId = await getCurrentOwnerId();

  if (!ownerId) {
    return jsonError("Unauthorized.", 401);
  }

  const parsed = createDatasetSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Dataset payload is invalid.");
  }

  if (!parsed.data.blobPath.startsWith(`users/${ownerId}/csv/`)) {
    return jsonError("Blob path is not owned by the current user.", 403);
  }

  const dataset = await createDataset({
    ownerId,
    ...parsed.data,
  });

  return Response.json({ dataset }, { status: 201 });
}
