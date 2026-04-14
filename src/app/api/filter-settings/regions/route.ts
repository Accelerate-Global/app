import { getCurrentIdentity } from "@/lib/auth";
import {
  createFilterRegion,
  FilterRegionConflictError,
  listFilterRegions,
} from "@/lib/filter-settings";
import { jsonError } from "@/lib/http";
import { filterRegionPayloadSchema } from "@/lib/validation";

export async function GET() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can manage filter settings.", 403);
  }

  const regions = await listFilterRegions();
  return Response.json({ regions });
}

export async function POST(request: Request) {
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

  try {
    const region = await createFilterRegion(parsed.data);
    return Response.json({ region }, { status: 201 });
  } catch (error) {
    if (error instanceof FilterRegionConflictError) {
      return jsonError(error.message, 409);
    }

    throw error;
  }
}
