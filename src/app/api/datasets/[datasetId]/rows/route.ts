import { getCurrentIdentity } from "@/lib/auth";
import { getAllDatasetRows, getDatasetRows } from "@/lib/datasets";
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
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const { datasetId } = await context.params;
  const url = new URL(request.url);
  const readAllRows = url.searchParams.get("all") === "true";
  const sortDirection =
    url.searchParams.get("sortDirection") === "desc" ? "desc" : "asc";

  const result = readAllRows
    ? await getAllDatasetRows({
        datasetId,
        includeDisabled: identity.isDatasetAdmin,
      })
    : await getDatasetRows({
        datasetId,
        page: numberParam(url.searchParams.get("page"), 1),
        pageSize: numberParam(url.searchParams.get("pageSize"), 25),
        filter: url.searchParams.get("filter") ?? undefined,
        sortColumn: url.searchParams.get("sortColumn") ?? undefined,
        sortDirection,
        includeDisabled: identity.isDatasetAdmin,
      });

  if (!result) {
    return jsonError("Dataset not found.", 404);
  }

  return Response.json(result);
}
