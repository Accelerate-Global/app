import { PRIVATE_DATA_CHAT_BOUNDARY_PLANNER_CASES } from "@/lib/private-data-chat/evaluation-suite-planner-boundaries";
import { PRIVATE_DATA_CHAT_V3_BASELINE_CASES } from "@/lib/private-data-chat/evaluation-suite-planner-helpers";
import { PRIVATE_DATA_CHAT_SUPPORTED_PLANNER_CASES } from "@/lib/private-data-chat/evaluation-suite-planner-supported";
import { PRIVATE_DATA_CHAT_SEMANTIC_RAG_PLANNER_CASES } from "@/lib/private-data-chat/evaluation-suite-planner-semantic-rag";
import type { PrivateDataChatPlannerEvaluationCase } from "@/lib/private-data-chat/evaluation-suite-types";

export const PRIVATE_DATA_CHAT_PLANNER_CAPABILITY_CASES: readonly PrivateDataChatPlannerEvaluationCase[] = [
  ...PRIVATE_DATA_CHAT_V3_BASELINE_CASES,
  ...PRIVATE_DATA_CHAT_SUPPORTED_PLANNER_CASES,
  ...PRIVATE_DATA_CHAT_BOUNDARY_PLANNER_CASES,
  ...PRIVATE_DATA_CHAT_SEMANTIC_RAG_PLANNER_CASES,
];
