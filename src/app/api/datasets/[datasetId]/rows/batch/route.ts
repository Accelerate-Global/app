import { getCurrentIdentity } from "@/lib/auth";
import { insertDatasetRowBatch } from "@/lib/datasets";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { rowBatchSchema } from "@/lib/validation";

type RowBatchContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function POST(request: Request, context: RowBatchContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("upload CSV data");
  }

  const { datasetId } = await context.params;
  const parsed = rowBatchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Row batch payload is invalid.");
  }

  const dataset = await insertDatasetRowBatch({
    datasetId,
    ...parsed.data,
  });

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ dataset });
}
