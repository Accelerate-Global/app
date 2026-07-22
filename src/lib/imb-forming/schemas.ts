import { z } from "zod";

export const imbFormingDecisionSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  warningsAcknowledged: z.boolean().optional(),
});

export const imbFormingArtifactKindSchema = z.enum([
  "rows",
  "findings",
  "manifest",
  "csv",
]);
