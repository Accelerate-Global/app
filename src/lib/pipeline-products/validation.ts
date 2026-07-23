import { z } from "zod";

import { TIER1_RELEASE_INPUT_KEYS } from "./types";

const uuid = z.uuid();
const checksum = z.string().regex(/^[0-9a-f]{64}$/u);

export const finalizePipelineReleaseSchema = z.object({
  releaseKey: z.string().trim().regex(/^[a-z][a-z0-9-]*$/u),
  resourceSetId: uuid,
  registryRevisionId: uuid,
  ruleVersion: z.string().trim().min(1),
  ruleChecksum: checksum,
  priorities: z.array(z.object({
    canonicalField: z.string().trim().min(1),
    prioritySourceKeys: z.array(z.string().trim().min(1)),
  })),
  members: z.array(z.object({
    inputKey: z.enum(TIER1_RELEASE_INPUT_KEYS),
    publicationId: uuid,
    expectedChecksum: checksum,
  })),
  reason: z.string().trim().min(1),
});

export const buildPipelineProductSchema = z.object({
  definitionKey: z.string().trim().min(1),
  releaseSetId: uuid.nullish(),
  parentPublicationId: uuid.nullish(),
});

export const pipelineRunDecisionSchema = z.object({
  reason: z.string().trim().min(1),
});

export const publishPipelineRunSchema = pipelineRunDecisionSchema.extend({
  acknowledgeWarnings: z.boolean().default(false),
  expectedCurrentPublicationId: uuid.nullable(),
});

export const rollbackPipelineProductTargetSchema = pipelineRunDecisionSchema.extend({
  publicationId: uuid,
  expectedCurrentPublicationId: uuid,
});

export const pipelineArtifactKindSchema = z.enum([
  "rows-json",
  "rows-csv",
  "findings-json",
  "lineage-json",
  "comparison-json",
]);
