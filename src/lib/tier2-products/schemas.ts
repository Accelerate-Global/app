import { z } from "zod";

import { TIER2_PRODUCT_KINDS } from "./types";
import { TIER2_CONTRACT_RESOURCE_KEYS } from "./admin";

const uuid = z.string().uuid();
const checksum = z.string().regex(/^[0-9a-f]{64}$/u);
const reason = z.string().trim().min(3).max(1000);

export const tier2ReleaseMemberSelectionSchema = z.object({
  inputKey: z.string().trim().regex(/^[a-z][a-z0-9-]*$/u),
  publicationId: uuid,
  expectedChecksum: checksum,
}).strict();

export const createTier2ReleaseSchema = z.object({
  productKind: z.enum(TIER2_PRODUCT_KINDS),
  resourceSetId: uuid,
  registryRevisionId: uuid,
  members: z.array(tier2ReleaseMemberSelectionSchema).min(1).max(250),
  reason,
}).strict();

export const publishTier2RunSchema = z.object({
  acknowledgeWarnings: z.boolean().default(false),
  reason,
}).strict();

export const rollbackTier2TargetSchema = z.object({
  publicationId: uuid,
  expectedCurrentPublicationId: uuid,
  reason,
}).strict();

export const activateTier2ResourceSchema = z.object({
  versionId: uuid,
  action: z.enum(["activate", "rollback"]).default("activate"),
  reason,
}).strict();

export const createTier2ResourceVersionSchema = z.object({
  resourceKey: z.enum(TIER2_CONTRACT_RESOURCE_KEYS),
  payload: z.unknown(),
  activate: z.boolean().default(false),
  reason,
}).strict();
