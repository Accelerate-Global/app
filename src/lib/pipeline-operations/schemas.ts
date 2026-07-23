import { z } from "zod";

export const PIPELINE_MIN_SCHEDULE_INTERVAL_MINUTES = 1440;

export const pipelineJsonObjectSchema = z.record(z.string(), z.unknown());

export const pipelineLaunchSchema = z.object({
  definitionKey: z.string().trim().regex(/^[a-z][a-z0-9-]*$/),
  launchKind: z.literal("manual").default("manual"),
  requestId: z.string().uuid(),
}).strict();

export const pipelineReviewSchema = z.object({
  stageKey: z.string().trim().regex(/^[a-z][a-z0-9-]*$/),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(3).max(1000),
  acknowledgeWarnings: z.boolean().default(false),
});

export const pipelineRetrySchema = z.object({
  stageKey: z.string().trim().regex(/^[a-z][a-z0-9-]*$/),
  reason: z.string().trim().min(3).max(1000),
});

export const pipelineRebuildSchema = z.object({
  requestId: z.string().uuid(),
}).strict();

export const pipelineBackfillSchema = z.object({
  definitionKey: z.string().trim().regex(/^[a-z][a-z0-9-]*$/),
  requestId: z.string().uuid(),
  exactInputs: pipelineJsonObjectSchema,
}).strict();

export const pipelineScheduleSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int()
    .min(PIPELINE_MIN_SCHEDULE_INTERVAL_MINUTES)
    .max(10080),
  canaryRunId: z.string().uuid(),
  sourceProfileId: z.string().uuid().nullable().optional(),
});
