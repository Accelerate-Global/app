import { getCurrentIdentity } from "@/lib/auth";
import {
  createDatasetStoragePath,
  getDatasetStorageBucket,
} from "@/lib/dataset-storage";
import { MAX_CSV_BYTES, sanitizeFileName } from "@/lib/csv";
import { logError } from "@/lib/error-logging";
import { jsonAdminOnlyError, jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { blobUploadTokenSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  if (!identity.isDatasetAdmin) {
    return jsonAdminOnlyError("upload CSV files");
  }

  const parsed = blobUploadTokenSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Upload request is invalid.");
  }

  const fileName = sanitizeFileName(parsed.data.fileName);

  if (!fileName.toLowerCase().endsWith(".csv")) {
    return jsonError("Only CSV uploads are supported.");
  }

  const bucket = getDatasetStorageBucket();
  const path = createDatasetStoragePath(fileName);

  try {
    const supabase = createSupabaseAdminClient();
    const bucketLookup = await supabase.storage.getBucket(bucket);

    if (bucketLookup.error) {
      if (bucketLookup.error.status !== 404) {
        throw bucketLookup.error;
      }

      const createdBucket = await supabase.storage.createBucket(bucket, {
        public: false,
        allowedMimeTypes: [
          "text/csv",
          "application/vnd.ms-excel",
          "text/plain",
        ],
        fileSizeLimit: MAX_CSV_BYTES,
      });

      if (createdBucket.error) {
        throw createdBucket.error;
      }
    }

    const signedUpload = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (signedUpload.error) {
      throw signedUpload.error;
    }

    return Response.json({
      mode: "supabase-storage",
      bucket,
      path,
      token: signedUpload.data.token,
    });
  } catch (error) {
    logError("Failed to create Supabase Storage upload authorization", error);
    return jsonError(
      "The upload could not be authorized by Supabase Storage.",
      502,
    );
  }
}
