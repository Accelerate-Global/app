import { z } from "zod";

import {
  UPLOAD_FAILURE_STAGES,
  captureOperationalEvent,
} from "@/lib/operational-alert-capture";
import { withRoute } from "@/lib/route-guard";

const uploadFailureRelaySchema = z.object({
  operationId: z.string().uuid(),
  stage: z.enum(UPLOAD_FAILURE_STAGES),
  datasetId: z.string().uuid().nullable().optional(),
}).strict();

export const POST = withRoute(
  { access: "admin", action: "report dataset upload failures" },
  async (_identity, request: Request) => {
    const parsed = uploadFailureRelaySchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      return Response.json(
        { error: "Upload failure report is invalid." },
        { status: 400 },
      );
    }

    await captureOperationalEvent({
      kind: "dataset-upload-failed",
      operationId: parsed.data.operationId,
      stage: parsed.data.stage,
      datasetId: parsed.data.datasetId,
    });

    return Response.json({ accepted: true }, { status: 202 });
  },
);
