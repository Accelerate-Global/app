import type { PrivateDataChatProvenanceSchema } from "@/lib/private-data-chat/event-types";

export type PrivateDataChatStage =
  | "interpreting"
  | "validating"
  | "querying"
  | "explaining";

export type PrivateDataChatTurnMessage = {
  content: string;
  facts: string[];
  provenance: PrivateDataChatProvenanceSchema | null;
};

export type PrivateDataChatStreamEvent =
  | { type: "status"; stage: PrivateDataChatStage }
  | { type: "message"; message: PrivateDataChatTurnMessage }
  | {
      type: "error";
      code: string;
      message: string;
      retryable: boolean;
    }
  | { type: "done" };

export function encodePrivateDataChatSse(event: PrivateDataChatStreamEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
