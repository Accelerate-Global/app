import type { z } from "zod";

import type { privateDataChatProvenanceSchema } from "@/lib/private-data-chat/schemas";

export type PrivateDataChatProvenanceSchema = z.infer<
  typeof privateDataChatProvenanceSchema
>;
