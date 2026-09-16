import type { PrivateDataChatProvenanceSchema } from "@/lib/private-data-chat/event-types";
import type { PrivateDataChatResourceQueryResult } from "@/lib/private-data-chat/schemas";

export type PrivateDataChatStage =
  | "interpreting"
  | "validating"
  | "querying"
  | "explaining";

export type PrivateDataChatTurnMessage = {
  content: string;
  facts: string[];
  provenance: PrivateDataChatProvenanceSchema | null;
  turnStateToken?: string | null;
  resourceResult?: PrivateDataChatResourceQueryResult | null;
};

export type PrivateDataChatResponse =
  | { type: "message"; message: PrivateDataChatTurnMessage }
  | {
      type: "error";
      code: string;
      message: string;
      retryable: boolean;
    };
