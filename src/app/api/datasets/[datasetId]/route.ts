import { randomUUID } from "node:crypto";

import {
  DatasetClassificationError,
  DatasetDeleteConflictError,
  DerivedDatasetMutationError,
  PipelineManagedDatasetMutationError,
  deleteDataset,
  getDataset,
  updateDatasetDetails,
  updateDatasetStatus,
} from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import { withRoute } from "@/lib/route-guard";
import { getDatasetStorageBucket } from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/error-logging";
import { datasetPatchSchema } from "@/lib/validation";

type DatasetContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export const GET = withRoute(
  { access: "user" },
  async (identity, _request: Request, context: DatasetContext) => {
    const { datasetId } = await context.params;
    const dataset = await getDataset(datasetId, {
      includeDisabled: identity.isDatasetAdmin,
    });

    if (!dataset) {
      return jsonError("Dataset not found.", 404);
    }

    return Response.json({ dataset });
  },
);

export const PATCH = withRoute(
  { access: "admin", action: "modify datasets" },
  async (_identity, request: Request, context: DatasetContext) => {
    const { datasetId } = await context.params;
    const parsed = datasetPatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("Dataset update payload is invalid.");
    }

    let dataset;

    try {
      dataset =
        "status" in parsed.data
          ? await updateDatasetStatus({
              datasetId,
              status: parsed.data.status,
              error: parsed.data.error,
            })
          : await updateDatasetDetails({
              datasetId,
              fileName: parsed.data.fileName,
              sourceOrganizationName: parsed.data.sourceOrganizationName,
              tags: parsed.data.tags,
              isPrimary: parsed.data.isPrimary,
              isWorkspaceVisible: parsed.data.isWorkspaceVisible,
              hiddenColumnKeys: parsed.data.hiddenColumnKeys,
            });
    } catch (error) {
      if (
        error instanceof DatasetClassificationError ||
        error instanceof DerivedDatasetMutationError ||
        error instanceof PipelineManagedDatasetMutationError
      ) {
        return jsonError(error.message, error.status);
      }

      throw error;
    }

    if (!dataset) {
      return jsonError("Dataset not found.", 404);
    }

    if ("status" in parsed.data && parsed.data.status === "failed") {
      await captureOperationalEvent({
        kind: "dataset-upload-failed",
        operationId: randomUUID(),
        stage: "terminal-import",
        datasetId,
      });
    }

    return Response.json({ dataset });
  },
);

export const DELETE = withRoute(
  { access: "admin", action: "delete datasets" },
  async (_identity, _request: Request, context: DatasetContext) => {
    const { datasetId } = await context.params;
    let deleted;

    try {
      deleted = await deleteDataset(datasetId);
    } catch (error) {
      if (
        error instanceof DatasetDeleteConflictError ||
        error instanceof PipelineManagedDatasetMutationError
      ) {
        return jsonError(error.message, error.status);
      }

      throw error;
    }

    if (!deleted) {
      return jsonError("Dataset not found.", 404);
    }

    if (deleted.blobPaths.length > 0) {
      try {
        const supabase = createSupabaseAdminClient();
        const deletion = await supabase.storage
          .from(getDatasetStorageBucket())
          .remove(deleted.blobPaths);

        if (deletion.error) {
          logError(
            "Failed to delete dataset file from Supabase Storage",
            deletion.error,
          );
        }
      } catch (error) {
        logError("Failed to delete dataset file from Supabase Storage", error);
      }
    }

    return Response.json({ dataset: deleted.dataset });
  },
);
