import { replaceDatasetContents } from "@/lib/datasets";
import { isDatasetStoragePath } from "@/lib/dataset-storage";
import { jsonError } from "@/lib/http";
import { withRoute } from "@/lib/route-guard";
import { replaceDatasetSchema } from "@/lib/validation";

type DatasetContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export const POST = withRoute(
  { access: "admin", action: "replace datasets" },
  async (identity, request: Request, context: DatasetContext) => {
    const parsed = replaceDatasetSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("Dataset replacement payload is invalid.");
    }

    if (!isDatasetStoragePath(parsed.data.blobPath)) {
      return jsonError("Dataset storage path is invalid.", 403);
    }

    const { datasetId } = await context.params;
    const replacement = await replaceDatasetContents({
      datasetId,
      actorOwnerId: identity.ownerId,
      actorEmail: identity.email,
      ...parsed.data,
    });

    if (!replacement) {
      return jsonError("Dataset not found.", 404);
    }

    return Response.json({ dataset: replacement.dataset });
  },
);
