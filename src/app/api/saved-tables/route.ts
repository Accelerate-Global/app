import { getCurrentIdentity } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import {
  createSavedDatasetTable,
  listSavedDatasetTables,
} from "@/lib/saved-dataset-tables";
import { savedDatasetTableCreateSchema } from "@/lib/validation";
import { canCreateSavedDatasetTables } from "@/lib/workspace-role";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const savedTables = await listSavedDatasetTables(identity.ownerId, {
    includeDisabled: identity.isDatasetAdmin,
  });
  return Response.json({ savedTables });
}

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!canCreateSavedDatasetTables(identity.workspaceRole)) {
    return jsonError("Basic accounts cannot save dataset tables.", 403);
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
    includeDisabled: identity.isDatasetAdmin,
  });

  if (!savedTable) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json({ savedTable }, { status: 201 });
}
