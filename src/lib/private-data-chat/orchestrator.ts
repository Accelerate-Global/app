import type { CurrentIdentity } from "@/lib/auth";
import { executePrivateDataChatQuery } from "@/lib/private-data-chat/broker";
import {
  compilePrivateDataChatQuery,
  PrivateDataChatQueryPolicyError,
} from "@/lib/private-data-chat/compiler";
import type {
  PrivateDataChatStage,
  PrivateDataChatTurnMessage,
} from "@/lib/private-data-chat/events";
import { getPrivateQwenGateway } from "@/lib/private-data-chat/get-qwen-gateway";
import {
  PrivateQwenGatewayError,
  type PrivateQwenConversationMessage,
  type PrivateQwenGateway,
} from "@/lib/private-data-chat/qwen-gateway";
import type { PrivateDataChatQueryResult } from "@/lib/private-data-chat/schemas";

export type PrivateDataChatOrchestratorDependencies = {
  gateway: PrivateQwenGateway;
  executeQuery: typeof executePrivateDataChatQuery;
};

const PRIVATE_DATA_CHAT_REPAIR_MESSAGE =
  "The previous semantic plan could not pass the deterministic query policy. Re-evaluate the original user question and return one complete corrected decision using only the approved catalog. Do not explain the failed plan.";

function deterministicQueryFallback(result: PrivateDataChatQueryResult) {
  if (result.rows.length === 0) {
    return {
      answer: "No matching records were found in the approved current dataset.",
      facts: [],
    };
  }

  return {
    answer: `The approved query returned ${result.rows.length} result ${
      result.rows.length === 1 ? "row" : "rows"
    }. The verified values are shown below.`,
    facts: result.rows.slice(0, 20).map((row) =>
      Object.entries(row)
        .map(([key, value]) => `${key}: ${String(value ?? "not available")}`)
        .join(", "),
    ),
  };
}

export async function orchestratePrivateDataChatTurn(input: {
  identity: CurrentIdentity;
  messages: PrivateQwenConversationMessage[];
  signal?: AbortSignal;
  onStage?: (stage: PrivateDataChatStage) => void;
  dependencies?: PrivateDataChatOrchestratorDependencies;
}): Promise<PrivateDataChatTurnMessage> {
  const dependencies = input.dependencies ?? {
    gateway: getPrivateQwenGateway(),
    executeQuery: executePrivateDataChatQuery,
  };
  const question = [...input.messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  if (!question) {
    throw new Error("A user question is required.");
  }

  input.onStage?.("interpreting");
  let plan = await dependencies.gateway.plan({
    messages: input.messages,
    signal: input.signal,
  });

  if (plan.decision === "clarify") {
    return { content: plan.question, facts: [], provenance: null };
  }

  if (plan.decision === "answer") {
    return { content: plan.answer, facts: [], provenance: null };
  }

  input.onStage?.("validating");
  let compiled: ReturnType<typeof compilePrivateDataChatQuery>;
  try {
    compiled = compilePrivateDataChatQuery(plan.query);
  } catch (error) {
    if (!(error instanceof PrivateDataChatQueryPolicyError)) {
      throw error;
    }

    plan = await dependencies.gateway.plan({
      messages: [
        ...input.messages.slice(-10),
        { role: "assistant", content: JSON.stringify(plan) },
        { role: "user", content: PRIVATE_DATA_CHAT_REPAIR_MESSAGE },
      ],
      signal: input.signal,
    });

    if (plan.decision === "clarify") {
      return { content: plan.question, facts: [], provenance: null };
    }

    if (plan.decision === "answer") {
      return { content: plan.answer, facts: [], provenance: null };
    }

    compiled = compilePrivateDataChatQuery(plan.query);
  }
  input.onStage?.("querying");
  const result = await dependencies.executeQuery({
    identity: input.identity,
    compiled,
  });
  input.onStage?.("explaining");

  try {
    const answer = await dependencies.gateway.answer({
      question,
      result,
      signal: input.signal,
    });
    return {
      content: answer.answer,
      facts: answer.facts,
      provenance: result.provenance,
    };
  } catch (error) {
    if (
      error instanceof PrivateQwenGatewayError &&
      input.signal?.aborted
    ) {
      throw error;
    }

    const fallback = deterministicQueryFallback(result);
    return {
      content: fallback.answer,
      facts: fallback.facts,
      provenance: result.provenance,
    };
  }
}
