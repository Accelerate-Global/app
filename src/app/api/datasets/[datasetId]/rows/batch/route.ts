import { getCurrentOwnerId } from "@/lib/auth";
import { insertDatasetRowBatch } from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { rowBatchSchema } from "@/lib/validation";

type RowBatchContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function POST(request: Request, context: RowBatchContext) {
  const ownerId = await getCurrentOwnerId();

  if (!ownerId) {
    return jsonError("Unauthorized.", 401);
  }

  const { datasetId } = await context.params;
  const parsed = rowBatchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Row batch payload is invalid.");
  }

  const dataset = await insertDatasetRowBatch({
    datasetId,
    ownerId,
    ...parsed.data,
  });

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ dataset });
}
