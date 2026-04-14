import { getCurrentIdentity } from "@/lib/auth";
import {
  deleteFilterRegion,
  FilterRegionConflictError,
  updateFilterRegion,
} from "@/lib/filter-settings";
import { jsonError } from "@/lib/http";
import { filterRegionPayloadSchema } from "@/lib/validation";

type FilterRegionContext = {
  params: Promise<{
    regionId: string;
  }>;
};

export async function PATCH(request: Request, context: FilterRegionContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can manage filter settings.", 403);
  }

  const parsed = filterRegionPayloadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Region payload is invalid.");
  }

  const { regionId } = await context.params;

  try {
    const region = await updateFilterRegion({
      regionId,
      ...parsed.data,
    });

    if (!region) {
      return jsonError("Region not found.", 404);
    }

    return Response.json({ region });
  } catch (error) {
    if (error instanceof FilterRegionConflictError) {
      return jsonError(error.message, 409);
    }

    throw error;
  }
}

export async function DELETE(_request: Request, context: FilterRegionContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can manage filter settings.", 403);
  }

  const { regionId } = await context.params;
  const deletedRegion = await deleteFilterRegion(regionId);

  if (!deletedRegion) {
    return jsonError("Region not found.", 404);
  }

  return Response.json({ regionId: deletedRegion.id });
}
