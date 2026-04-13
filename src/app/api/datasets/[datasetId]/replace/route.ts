import { getCurrentIdentity } from "@/lib/auth";
import { replaceDatasetContents } from "@/lib/datasets";
import {
  getDatasetStorageBucket,
  isDatasetStoragePath,
} from "@/lib/dataset-storage";
import { jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createDatasetSchema } from "@/lib/validation";

type DatasetContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function POST(request: Request, context: DatasetContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonError("Only admin@example.com can replace datasets.", 403);
  }

  const parsed = createDatasetSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Dataset replacement payload is invalid.");
  }

  if (!isDatasetStoragePath(parsed.data.blobPath)) {
    return jsonError("Dataset storage path is invalid.", 403);
  }

  const { datasetId } = await context.params;
  const replacement = await replaceDatasetContents({
    datasetId,
    ...parsed.data,
  });

  if (!replacement) {
    return jsonError("Dataset not found.", 404);
  }

  if (replacement.previousBlobPath !== parsed.data.blobPath) {
    try {
      const supabase = createSupabaseAdminClient();
      const deletion = await supabase.storage
        .from(getDatasetStorageBucket())
        .remove([replacement.previousBlobPath]);

      if (deletion.error) {
        console.error(
          "Failed to delete previous dataset file from Supabase Storage",
          deletion.error,
        );
      }
    } catch (error) {
      console.error("Failed to delete previous dataset file from Supabase Storage", error);
    }
  }

  return Response.json({ dataset: replacement.dataset });
}
