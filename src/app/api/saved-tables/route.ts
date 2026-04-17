import { getCurrentIdentity } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import {
  createSavedDatasetTable,
  listSavedDatasetTables,
} from "@/lib/saved-dataset-tables";
import { savedDatasetTableCreateSchema } from "@/lib/validation";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const savedTables = await listSavedDatasetTables(identity.ownerId);
  return Response.json({ savedTables });
}

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const parsed = savedDatasetTableCreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Saved table payload is invalid.");
  }

  const savedTable = await createSavedDatasetTable({
    ownerId: identity.ownerId,
    datasetId: parsed.data.datasetId,
    filters: parsed.data.filters,
    savedRowCount: parsed.data.savedRowCount,
  });

  if (!savedTable) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ savedTable }, { status: 201 });
}
