import { listDatasetVersions } from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";

type DatasetVersionsContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export const GET = withRoute(
  { access: "admin", action: "read dataset upload history" },
  async (_identity, _request: Request, context: DatasetVersionsContext) => {
    const { datasetId } = await context.params;
    const versions = await listDatasetVersions(datasetId);

    if (!versions) {
      return jsonError("Dataset not found.", 404);
    }

    return Response.json({ versions });
  },
);
