import { getCurrentIdentity } from "@/lib/auth";
import { getDataset } from "@/lib/datasets";
import { getDatasetStorageBucket } from "@/lib/dataset-storage";
import { jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DatasetContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function GET(_request: Request, context: DatasetContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const { datasetId } = await context.params;
  const dataset = await getDataset(datasetId);

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  try {
    const supabase = createSupabaseAdminClient();
    const signedUrl = await supabase.storage
      .from(getDatasetStorageBucket())
      .createSignedUrl(dataset.blobPath, 60, {
        download: dataset.fileName,
      });

    if (signedUrl.error) {
      throw signedUrl.error;
    }

    return Response.redirect(signedUrl.data.signedUrl);
  } catch (error) {
    console.error("Failed to create a signed dataset download URL", error);
    return jsonError("The dataset download could not be prepared.", 502);
  }
}
