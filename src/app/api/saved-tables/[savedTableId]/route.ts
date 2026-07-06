import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
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

export const GET = withRoute(
  { access: "user" },
  async (identity, _request: Request, context: SavedTableContext) => {
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
  },
);

export const PATCH = withRoute(
  { access: "user" },
  async (identity, request: Request, context: SavedTableContext) => {
    const parsed = savedDatasetTableUpdateSchema.safeParse(
      await request.json(),
    );

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
  },
);

export const DELETE = withRoute(
  { access: "user" },
  async (identity, _request: Request, context: SavedTableContext) => {
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
  },
);
