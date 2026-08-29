import { createHash, createHmac, randomUUID } from "node:crypto";

import { getPrivateDataChatConfiguration } from "@/lib/private-data-chat/config";
import type { PrivateDataChatAnswerSemanticContext } from "@/lib/private-data-chat/catalog";
import {
  PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT,
  PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT,
} from "@/lib/private-data-chat/prompts";
import {
  PRIVATE_DATA_CHAT_ANSWER_JSON_SCHEMA,
  PRIVATE_DATA_CHAT_PLAN_JSON_SCHEMA,
  privateDataChatAnswerSchema,
  privateDataChatPlanSchema,
  type PrivateDataChatAnswer,
  type PrivateDataChatPlan,
  type PrivateDataChatQueryResult,
} from "@/lib/private-data-chat/schemas";

const PRIVATE_QWEN_GATEWAY_TIMEOUT_MS = 90_000;
const PRIVATE_QWEN_MAX_RESPONSE_BYTES = 128_000;

export type PrivateQwenConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export interface PrivateQwenGateway {
  plan(input: {
    messages: PrivateQwenConversationMessage[];
    signal?: AbortSignal;
  }): Promise<PrivateDataChatPlan>;
  answer(input: {
    question: string;
    result: PrivateDataChatQueryResult;
    semanticContext: PrivateDataChatAnswerSemanticContext;
    signal?: AbortSignal;
  }): Promise<PrivateDataChatAnswer>;
}

export type PrivateQwenGatewayErrorCode =
  | "unavailable"
  | "busy"
  | "invalid_response"
  | "timeout"
  | "internal";

export class PrivateQwenGatewayError extends Error {
  readonly code: PrivateQwenGatewayErrorCode;
  readonly retryable: boolean;

  constructor(
    code: PrivateQwenGatewayErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "PrivateQwenGatewayError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function signPrivateQwenGatewayRequest(input: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
  key: string;
}) {
  const bodyDigest = createHash("sha256").update(input.body).digest("hex");
  const canonical = [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    bodyDigest,
  ].join("\n");
  return `v1=${createHmac("sha256", input.key).update(canonical).digest("hex")}`;
}

function gatewayErrorForStatus(status: number) {
  if (status === 429 || status === 503) {
    return new PrivateQwenGatewayError(
      status === 429 ? "busy" : "unavailable",
      status === 429
        ? "Private Qwen capacity is currently full."
        : "Private Qwen is currently unavailable.",
      true,
    );
  }

  if (status >= 400 && status < 500) {
    return new PrivateQwenGatewayError(
      "invalid_response",
      "The private Qwen gateway rejected the request.",
    );
  }

  return new PrivateQwenGatewayError(
    "internal",
    "The private Qwen gateway could not complete the request.",
    status >= 500,
  );
}

function combineAbortSignals(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const abort = () => controller.abort(signal?.reason ?? "cancelled");

  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    },
  };
}

export class HttpPrivateQwenGateway implements PrivateQwenGateway {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    fetcher: typeof fetch = fetch,
    timeoutMs = PRIVATE_QWEN_GATEWAY_TIMEOUT_MS,
  ) {
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
  }

  private async request(input: {
    path: "/v1/private-data-chat/plan" | "/v1/private-data-chat/answer";
    body: Record<string, unknown>;
    signal?: AbortSignal;
  }) {
    const configuration = getPrivateDataChatConfiguration();

    if (
      !configuration.qwenGatewayUrl ||
      !configuration.qwenGatewayHmacKey ||
      !configuration.cloudflareAccessClientId ||
      !configuration.cloudflareAccessClientSecret
    ) {
      throw new PrivateQwenGatewayError(
        "unavailable",
        "Private Qwen gateway configuration is unavailable.",
      );
    }

    const url = new URL(input.path, configuration.qwenGatewayUrl);
    const body = JSON.stringify(input.body);
    const timestamp = String(Date.now());
    const nonce = randomUUID();
    const signature = signPrivateQwenGatewayRequest({
      method: "POST",
      path: input.path,
      timestamp,
      nonce,
      body,
      key: configuration.qwenGatewayHmacKey,
    });
    const abort = combineAbortSignals(
      input.signal,
      this.timeoutMs,
    );

    try {
      const response = await this.fetcher(url, {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "CF-Access-Client-Id": configuration.cloudflareAccessClientId,
          "CF-Access-Client-Secret":
            configuration.cloudflareAccessClientSecret,
          "X-AG-Timestamp": timestamp,
          "X-AG-Nonce": nonce,
          "X-AG-Signature": signature,
        },
        body,
      });

      if (!response.ok) {
        throw gatewayErrorForStatus(response.status);
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(contentLength) &&
        contentLength > PRIVATE_QWEN_MAX_RESPONSE_BYTES
      ) {
        throw new PrivateQwenGatewayError(
          "invalid_response",
          "Private Qwen returned an oversized response.",
        );
      }

      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > PRIVATE_QWEN_MAX_RESPONSE_BYTES) {
        throw new PrivateQwenGatewayError(
          "invalid_response",
          "Private Qwen returned an oversized response.",
        );
      }

      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new PrivateQwenGatewayError(
          "invalid_response",
          "Private Qwen returned invalid JSON.",
        );
      }
    } catch (error) {
      if (error instanceof PrivateQwenGatewayError) {
        throw error;
      }

      if (abort.signal.aborted) {
        throw new PrivateQwenGatewayError(
          abort.signal.reason === "timeout" ? "timeout" : "unavailable",
          abort.signal.reason === "timeout"
            ? "Private Qwen exceeded its response deadline."
            : "Private Qwen request was cancelled.",
          abort.signal.reason === "timeout",
        );
      }

      throw new PrivateQwenGatewayError(
        "unavailable",
        "Private Qwen could not be reached.",
        true,
      );
    } finally {
      abort.cleanup();
    }
  }

  async plan(input: {
    messages: PrivateQwenConversationMessage[];
    signal?: AbortSignal;
  }) {
    const data = await this.request({
      path: "/v1/private-data-chat/plan",
      signal: input.signal,
      body: {
        systemPrompt: PRIVATE_DATA_CHAT_PLANNER_SYSTEM_PROMPT,
        messages: input.messages,
        responseSchema: PRIVATE_DATA_CHAT_PLAN_JSON_SCHEMA,
        temperature: 0,
        maxTokens: 700,
      },
    });
    const parsed = privateDataChatPlanSchema.safeParse(data);

    if (!parsed.success) {
      throw new PrivateQwenGatewayError(
        "invalid_response",
        "Private Qwen returned an invalid semantic plan.",
      );
    }

    return parsed.data;
  }

  async answer(input: {
    question: string;
    result: PrivateDataChatQueryResult;
    semanticContext: PrivateDataChatAnswerSemanticContext;
    signal?: AbortSignal;
  }) {
    const data = await this.request({
      path: "/v1/private-data-chat/answer",
      signal: input.signal,
      body: {
        systemPrompt: PRIVATE_DATA_CHAT_ANSWER_SYSTEM_PROMPT,
        question: input.question,
        semanticContext: input.semanticContext,
        result: input.result,
        responseSchema: PRIVATE_DATA_CHAT_ANSWER_JSON_SCHEMA,
        temperature: 0,
        maxTokens: 700,
      },
    });
    const parsed = privateDataChatAnswerSchema.safeParse(data);

    if (!parsed.success) {
      throw new PrivateQwenGatewayError(
        "invalid_response",
        "Private Qwen returned an invalid grounded answer.",
      );
    }

    return parsed.data;
  }
}
