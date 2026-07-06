import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import {
  createSavedDatasetTable,
  listSavedDatasetTables,
} from "@/lib/saved-dataset-tables";
import { savedDatasetTableCreateSchema } from "@/lib/validation";
import { canCreateSavedDatasetTables } from "@/lib/workspace-role";

export const GET = withRoute({ access: "user" }, async (identity) => {
  const savedTables = await listSavedDatasetTables(identity.ownerId, {
    includeDisabled: identity.isDatasetAdmin,
  });
  return Response.json({ savedTables });
});

export const POST = withRoute(
  { access: "user" },
  async (identity, request: Request) => {
    if (!canCreateSavedDatasetTables(identity.workspaceRole)) {
      return jsonError("Basic accounts cannot save dataset tables.", 403);
    }

    const parsed = savedDatasetTableCreateSchema.safeParse(
      await request.json(),
    );

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
  },
);
