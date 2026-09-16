import { jsonError } from "@/lib/http";
import { canUsePrivateDataChat } from "@/lib/private-data-chat/access";
import { getPrivateDataChatConfiguration } from "@/lib/private-data-chat/config";
import type { PrivateDataChatResponse } from "@/lib/private-data-chat/events";
import { orchestratePrivateDataChatTurn } from "@/lib/private-data-chat/orchestrator";
import { PrivateDataChatBrokerError } from "@/lib/private-data-chat/broker";
import { PrivateQwenGatewayError } from "@/lib/private-data-chat/qwen-gateway";
import { privateDataChatRequestSchema } from "@/lib/private-data-chat/schemas";
import { PrivateDataChatValueResolutionError } from "@/lib/private-data-chat/value-resolver";
import { PrivateDataChatSignedStateError } from "@/lib/private-data-chat/signed-state";
import { withRoute } from "@/lib/route-guard";

const PRIVATE_DATA_CHAT_MAX_REQUEST_BYTES = 30_000;
export const maxDuration = 300;

function responseError(
  error: unknown,
): Extract<PrivateDataChatResponse, { type: "error" }> {
  if (error instanceof PrivateQwenGatewayError) {
    return {
      type: "error",
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }

  if (error instanceof PrivateDataChatBrokerError) {
    return {
      type: "error",
      code: error.code,
      message: "The approved data query could not be completed.",
      retryable: error.code === "query_failed",
    };
  }

  if (error instanceof PrivateDataChatValueResolutionError) {
    return {
      type: "error",
      code: error.code,
      message: "The approved semantic value resource is temporarily unavailable.",
      retryable: error.retryable,
    };
  }

  if (error instanceof PrivateDataChatSignedStateError) {
    return {
      type: "error",
      code: error.code,
      message: "The trusted conversation context is invalid or expired.",
      retryable: false,
    };
  }

  return {
    type: "error",
    code: "internal",
    message: "The private data chat request could not be completed.",
    retryable: false,
  };
}

export const POST = withRoute(
  { access: "admin", action: "use private data chat" },
  async (identity, request: Request) => {
    const contentLength = Number(request.headers.get("content-length"));

    if (
      Number.isFinite(contentLength) &&
      contentLength > PRIVATE_DATA_CHAT_MAX_REQUEST_BYTES
    ) {
      return jsonError("Conversation payload is too large.", 413);
    }

    const configuration = getPrivateDataChatConfiguration();
    if (!canUsePrivateDataChat(identity, configuration)) {
      return jsonError("Private data chat is unavailable.", 503);
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return jsonError("Conversation payload is invalid.");
    }

    if (Buffer.byteLength(rawBody, "utf8") > PRIVATE_DATA_CHAT_MAX_REQUEST_BYTES) {
      return jsonError("Conversation payload is too large.", 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return jsonError("Conversation payload is invalid.");
    }

    const parsed = privateDataChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Conversation payload is invalid.");
    }

    try {
      const message = await orchestratePrivateDataChatTurn({
        identity,
        messages: parsed.data.messages,
        conversationId: parsed.data.conversationId,
        viewContextToken: parsed.data.viewContextToken,
        turnStateTokens: parsed.data.turnStateTokens,
        resourceContinuationToken: parsed.data.resourceContinuationToken,
        signal: request.signal,
      });

      return Response.json({
        type: "message",
        message,
      } satisfies PrivateDataChatResponse);
    } catch (error) {
      return Response.json(responseError(error));
    }
  },
);
