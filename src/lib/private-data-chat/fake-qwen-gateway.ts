import { PRIVATE_DATA_CHAT_EVALUATION_CASES } from "@/lib/private-data-chat/evaluation-cases";
import type { PrivateDataChatAnswerSemanticContext } from "@/lib/private-data-chat/catalog";
import type {
  PrivateQwenConversationMessage,
  PrivateQwenGateway,
} from "@/lib/private-data-chat/qwen-gateway";
import type {
  PrivateDataChatAnswer,
  PrivateDataChatQueryResult,
} from "@/lib/private-data-chat/schemas";

function lastUserQuestion(messages: PrivateQwenConversationMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")
    ?.content;
}

function sameConversation(
  left: PrivateQwenConversationMessage[],
  right: PrivateQwenConversationMessage[],
) {
  return (
    left.length === right.length &&
    left.every(
      (message, index) =>
        message.role === right[index]?.role &&
        message.content === right[index]?.content,
    )
  );
}

function deterministicAnswer(result: PrivateDataChatQueryResult): PrivateDataChatAnswer {
  if (result.rows.length === 0) {
    return {
      answer: "No matching records were found in the approved current dataset.",
      facts: [],
    };
  }

  const facts = result.rows.slice(0, 10).map((row) =>
    Object.entries(row)
      .map(([key, value]) => `${key}: ${String(value ?? "not available")}`)
      .join(", "),
  );

  return {
    answer: `The approved query returned ${result.rows.length} result ${
      result.rows.length === 1 ? "row" : "rows"
    }.`,
    facts,
  };
}

export class FakePrivateQwenGateway implements PrivateQwenGateway {
  async plan(input: { messages: PrivateQwenConversationMessage[] }) {
    const question = lastUserQuestion(input.messages);
    const matching = PRIVATE_DATA_CHAT_EVALUATION_CASES.find(
      (testCase) =>
        (testCase.conversation &&
          sameConversation(testCase.conversation, input.messages)) ||
        (!testCase.conversation && testCase.question === question),
    );

    return (
      matching?.expectedPlan ?? {
        decision: "clarify" as const,
        question:
          "I can currently answer bounded questions about approved people-group counts, population, countries, engagement, GSEC, and frontier-group status. Which of those would you like to explore?",
        reason: "The deterministic fake does not recognize this sanitized case.",
      }
    );
  }

  async answer(input: {
    question: string;
    result: PrivateDataChatQueryResult;
    semanticContext: PrivateDataChatAnswerSemanticContext;
    signal?: AbortSignal;
  }) {
    return deterministicAnswer(input.result);
  }
}
