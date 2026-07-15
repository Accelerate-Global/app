import { z } from "zod";

export const partnerExportColumnInputSchema = z.object({
  outputHeader: z.string().trim().min(1).max(128),
  sourceColumnKeys: z.array(z.string().trim().min(1).max(128)).max(10),
  sourceLabelSnapshot: z.array(z.string().trim().max(256)).max(10),
  transform: z.enum([
    "copy",
    "coalesce",
    "literal",
    "whole_number",
    "iso_timestamp",
    "non_negative_whole_number",
  ]),
  literalValue: z.string().max(500).nullable().default(null),
  required: z.boolean().default(false),
  requiredSeverity: z.enum(["error", "warning"]).default("error"),
});

export const partnerExportProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  partnerKey: z.enum(["custom", "joshua-project"]),
  fileNameStem: z.string().trim().min(1).max(160),
  columns: z.array(partnerExportColumnInputSchema).min(1).max(500),
});

export const partnerExportRunInputSchema = z.object({
  warningsAcknowledged: z.boolean().default(false),
});

export const partnerExportArtifactFormatSchema = z.enum([
  "csv",
  "crosswalk",
  "validation",
]);
