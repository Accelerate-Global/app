import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { reorderDatasets } from "@/lib/datasets";
import { datasetReorderSchema } from "@/lib/validation";

export const POST = withRoute(
  { access: "admin", action: "reorder datasets" },
  async (_identity, request: Request) => {
    const parsed = datasetReorderSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("Dataset order payload is invalid.");
    }

    const datasets = await reorderDatasets(parsed.data.datasetIds);

    if (!datasets) {
      return jsonError("One or more datasets could not be reordered.", 404);
    }

    return Response.json({ datasets });
  },
);
