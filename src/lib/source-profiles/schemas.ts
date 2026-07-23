import { z } from "zod";

import { CONFIGURABLE_SOURCE_PROFILE_KEYS } from "./types";

export const sourceProfileBindingInputSchema = z.object({
  sourceProfileKey: z.enum(CONFIGURABLE_SOURCE_PROFILE_KEYS),
  stableKeyColumn: z.string().trim().min(1).max(250),
});
