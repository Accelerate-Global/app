import { randomUUID } from "node:crypto";

import {
  DerivedDatasetMutationError,
  insertDatasetRowBatch,
  PipelineManagedDatasetMutationError,
} from "@/lib/datasets";
import { jsonError } from "@/lib/http";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import { withRoute } from "@/lib/route-guard";
import { rowBatchSchema } from "@/lib/validation";

type RowBatchContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export const POST = withRoute(
  { access: "admin", action: "upload CSV data" },
  async (_identity, request: Request, context: RowBatchContext) => {
    const { datasetId } = await context.params;
    const parsed = rowBatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonError("Row batch payload is invalid.");
    }

    let dataset;

    try {
      dataset = await insertDatasetRowBatch({
        datasetId,
        ...parsed.data,
      });
    } catch (error) {
      if (
        error instanceof DerivedDatasetMutationError ||
        error instanceof PipelineManagedDatasetMutationError
      ) {
        return jsonError(error.message, error.status);
      }

      await captureOperationalEvent({
        kind: "dataset-upload-failed",
        operationId: randomUUID(),
        stage: "row-persistence",
        datasetId,
      });
      throw error;
    }

    if (!dataset) {
      return jsonError("Dataset not found.", 404);
    }

    return Response.json({ dataset });
  },
);
