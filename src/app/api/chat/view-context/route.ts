import { z } from "zod";

import { jsonError } from "@/lib/http";
import { canUsePrivateDataChat } from "@/lib/private-data-chat/access";
import { getPrivateDataChatConfiguration } from "@/lib/private-data-chat/config";
import {
  buildPrivateDataChatViewContextDraft,
  createPrivateDataChatViewContextToken,
  getPrivateDataChatCurrentPrimaryDatasetVersion,
  PrivateDataChatViewContextError,
  PRIVATE_DATA_CHAT_VIEW_CONTEXT_TTL_MS,
} from "@/lib/private-data-chat/view-context";
import { withRoute } from "@/lib/route-guard";
import { savedDatasetFilterStateSchema } from "@/lib/validation";

const requestSchema = z
  .object({
    datasetId: z.string().uuid(),
    conversationId: z.string().uuid(),
    filters: savedDatasetFilterStateSchema,
  })
  .strict();

export const POST = withRoute(
  { access: "admin", action: "hand a current dataset view to private data chat" },
  async (identity, request: Request) => {
    const configuration = getPrivateDataChatConfiguration();
    if (!canUsePrivateDataChat(identity, configuration)) {
      return jsonError("Private data chat is unavailable.", 503);
    }
    if (!configuration.viewContextHmacKey) {
      return jsonError("Current-view handoff is unavailable.", 503);
    }
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Current-view handoff is invalid.");

    const currentDataset = await getPrivateDataChatCurrentPrimaryDatasetVersion();
    if (!currentDataset || currentDataset.id !== parsed.data.datasetId) {
      return jsonError(
        "Only the approved current primary dataset can be handed to chat.",
        409,
      );
    }

    try {
      const draft = buildPrivateDataChatViewContextDraft({
        datasetId: currentDataset.id,
        filters: parsed.data.filters,
      });
      const now = Date.now();
      return Response.json({
        token: createPrivateDataChatViewContextToken({
          ownerId: identity.ownerId,
          conversationId: parsed.data.conversationId,
          datasetId: currentDataset.id,
          datasetVersionCreatedAt: currentDataset.versionCreatedAt,
          ...draft,
          key: configuration.viewContextHmacKey,
          now,
        }),
        conversationId: parsed.data.conversationId,
        summary: draft.summary,
        expiresAt: now + PRIVATE_DATA_CHAT_VIEW_CONTEXT_TTL_MS,
      });
    } catch (error) {
      if (error instanceof PrivateDataChatViewContextError) {
        return jsonError(error.message, 400);
      }
      throw error;
    }
  },
);
