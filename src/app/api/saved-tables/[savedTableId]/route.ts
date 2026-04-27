import { getCurrentIdentity } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import {
  deleteSavedDatasetTable,
  getSavedDatasetTable,
  updateSavedDatasetTable,
} from "@/lib/saved-dataset-tables";
import { savedDatasetTableUpdateSchema } from "@/lib/validation";

type SavedTableContext = {
  params: Promise<{
    savedTableId: string;
  }>;
};

export async function GET(_request: Request, context: SavedTableContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const { savedTableId } = await context.params;
  const savedTable = await getSavedDatasetTable({
    ownerId: identity.ownerId,
    savedTableId,
    includeDisabled: identity.isDatasetAdmin,
  });

  if (!savedTable) {
    return jsonError("Saved table not found.", 404);
  }

  return Response.json({ savedTable });
}

export async function PATCH(request: Request, context: SavedTableContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const parsed = savedDatasetTableUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Saved table payload is invalid.");
  }

  const { savedTableId } = await context.params;
  const savedTable = await updateSavedDatasetTable({
    ownerId: identity.ownerId,
    savedTableId,
    name: parsed.data.name,
    details: parsed.data.details,
    includeDisabled: identity.isDatasetAdmin,
  });

  if (!savedTable) {
    return jsonError("Saved table not found.", 404);
  }

  return Response.json({ savedTable });
}

export async function DELETE(_request: Request, context: SavedTableContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const { savedTableId } = await context.params;
  const savedTable = await deleteSavedDatasetTable({
    ownerId: identity.ownerId,
    savedTableId,
    includeDisabled: identity.isDatasetAdmin,
  });

  if (!savedTable) {
    return jsonError("Saved table not found.", 404);
  }

  return Response.json({ savedTable });
}
