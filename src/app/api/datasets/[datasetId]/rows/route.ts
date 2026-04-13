import { getCurrentOwnerId } from "@/lib/auth";
import { getDatasetRows } from "@/lib/datasets";
import { jsonError } from "@/lib/http";

type RowsContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

function numberParam(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request, context: RowsContext) {
  const ownerId = await getCurrentOwnerId();

  if (!ownerId) {
    return jsonError("Unauthorized.", 401);
  }

  const { datasetId } = await context.params;
  const url = new URL(request.url);
  const sortDirection =
    url.searchParams.get("sortDirection") === "desc" ? "desc" : "asc";

  const result = await getDatasetRows({
    datasetId,
    ownerId,
    page: numberParam(url.searchParams.get("page"), 1),
    pageSize: numberParam(url.searchParams.get("pageSize"), 25),
    filter: url.searchParams.get("filter") ?? undefined,
    sortColumn: url.searchParams.get("sortColumn") ?? undefined,
    sortDirection,
  });

  if (!result) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json(result);
}
