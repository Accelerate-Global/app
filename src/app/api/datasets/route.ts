import { randomUUID } from "node:crypto";

import {
  DatasetStoragePathConflictError,
  createDataset,
  listDatasets,
} from "@/lib/datasets";
import { isDatasetStoragePath } from "@/lib/dataset-storage";
import { jsonError } from "@/lib/http";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import { withRoute } from "@/lib/route-guard";
import { createDatasetSchema } from "@/lib/validation";

export const GET = withRoute({ access: "user" }, async (identity) => {
  const datasets = await listDatasets({
    includeDisabled: identity.isDatasetAdmin,
  });
  return Response.json({ datasets });
});

export const POST = withRoute(
  { access: "admin", action: "upload CSV files" },
  async (identity, request: Request) => {
    const parsed = createDatasetSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("Dataset payload is invalid.");
    }

    if (!isDatasetStoragePath(parsed.data.blobPath)) {
      return jsonError("Dataset storage path is invalid.", 403);
    }

    let dataset;

    try {
      dataset = await createDataset({
        ownerId: identity.ownerId,
        actorEmail: identity.email,
        ...parsed.data,
      });
    } catch (error) {
      if (error instanceof DatasetStoragePathConflictError) {
        return jsonError(error.message, error.status);
      }

      await captureOperationalEvent({
        kind: "dataset-upload-failed",
        operationId: randomUUID(),
        stage: "dataset-create",
      });
      throw error;
    }

    return Response.json({ dataset }, { status: 201 });
  },
);
