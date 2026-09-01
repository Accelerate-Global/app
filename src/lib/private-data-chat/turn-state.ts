import { createHash } from "node:crypto";
import { z } from "zod";

import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_DATASET_KEY,
} from "@/lib/private-data-chat/catalog";
import type { CompiledPrivateDataChatQuery } from "@/lib/private-data-chat/compiler";
import { buildPrivateDataChatEvidenceLedger } from "@/lib/private-data-chat/evidence";
import { PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION } from "@/lib/private-data-chat/named-filters";
import type { PrivateDataChatQueryResult } from "@/lib/private-data-chat/schemas";
import {
  privateDataChatSubjectBinding,
  PrivateDataChatSignedStateError,
  signPrivateDataChatState,
  verifyPrivateDataChatState,
} from "@/lib/private-data-chat/signed-state";

export const PRIVATE_DATA_CHAT_TURN_STATE_TTL_MS = 30 * 60 * 1_000;
const TURN_STATE_PURPOSE = "turn-state";

const turnStatePayloadSchema = z
  .object({
    version: z.literal(1),
    subject: z.string().regex(/^[0-9a-f]{64}$/u),
    conversationId: z.string().uuid(),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    catalogVersion: z.literal(PRIVATE_DATA_CHAT_CATALOG_VERSION),
    namedFilterRegistryVersion: z.literal(
      PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
    ),
    semanticSnapshotChecksum: z.string().regex(/^[0-9a-f]{64}$/u).nullable(),
    decision: z.literal("query"),
    mode: z.enum(["aggregate", "records"]),
    selectedConcepts: z.array(z.string().min(1).max(100)).max(12),
    namedFilterKeys: z.array(z.string().min(1).max(100)).max(4),
    requestedLimit: z.number().int().positive(),
    returnedCount: z.number().int().nonnegative(),
    matchingCount: z.number().int().nonnegative(),
    hasMore: z.boolean(),
    dataset: z.literal(PRIVATE_DATA_CHAT_DATASET_KEY),
    datasetId: z.string().uuid().nullable(),
    datasetVersionCreatedAt: z.string().datetime().nullable(),
    evidenceIds: z.array(z.string().min(1).max(150)).max(32),
    resultChecksum: z.string().regex(/^[0-9a-f]{64}$/u),
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.expiresAt <= payload.issuedAt) {
      context.addIssue({
        code: "custom",
        message: "Turn-state expiry must follow issuance.",
        path: ["expiresAt"],
      });
    }
    if (payload.hasMore !== (payload.matchingCount > payload.returnedCount)) {
      context.addIssue({
        code: "custom",
        message: "Turn-state completeness is inconsistent.",
        path: ["hasMore"],
      });
    }
  });

export type PrivateDataChatTurnState = z.infer<typeof turnStatePayloadSchema>;

function resultChecksum(result: PrivateDataChatQueryResult) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        mode: result.mode,
        requestedLimit: result.requestedLimit,
        returnedCount: result.returnedCount,
        matchingCount: result.matchingCount,
        selectedConcepts: result.selectedConcepts,
        appliedNamedFilters: result.appliedNamedFilters,
        rows: result.rows,
        datasetId: result.provenance.datasetId,
        datasetVersionCreatedAt: result.provenance.datasetVersionCreatedAt,
      }),
    )
    .digest("hex");
}

export function createPrivateDataChatTurnStateToken(input: {
  ownerId: string;
  conversationId: string;
  compiled: CompiledPrivateDataChatQuery;
  result: PrivateDataChatQueryResult;
  semanticSnapshotChecksum?: string | null;
  key: string;
  now?: number;
  ttlMs?: number;
}) {
  const issuedAt = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? PRIVATE_DATA_CHAT_TURN_STATE_TTL_MS;
  const evidence = buildPrivateDataChatEvidenceLedger(input.result);
  const payload = turnStatePayloadSchema.parse({
    version: 1,
    subject: privateDataChatSubjectBinding({
      ownerId: input.ownerId,
      key: input.key,
    }),
    conversationId: input.conversationId,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
    catalogVersion: input.compiled.catalogVersion,
    namedFilterRegistryVersion:
      input.compiled.query.namedFilterRegistryVersion,
    semanticSnapshotChecksum: input.semanticSnapshotChecksum ?? null,
    decision: "query",
    mode: input.result.mode,
    selectedConcepts: input.result.selectedConcepts,
    namedFilterKeys: input.result.appliedNamedFilters,
    requestedLimit: input.result.requestedLimit,
    returnedCount: input.result.returnedCount,
    matchingCount: input.result.matchingCount,
    hasMore: input.result.hasMore,
    dataset: input.result.provenance.dataset,
    datasetId: input.result.provenance.datasetId,
    datasetVersionCreatedAt: input.result.provenance.datasetVersionCreatedAt,
    evidenceIds: evidence.items.slice(0, 32).map((item) => item.id),
    resultChecksum: resultChecksum(input.result),
  });

  return signPrivateDataChatState({
    purpose: TURN_STATE_PURPOSE,
    payload,
    key: input.key,
  });
}

export function verifyPrivateDataChatTurnStateToken(input: {
  token: string;
  ownerId: string;
  conversationId: string;
  key: string;
  now?: number;
  semanticSnapshotChecksum?: string | null;
}) {
  const parsed = turnStatePayloadSchema.safeParse(
    verifyPrivateDataChatState({
      purpose: TURN_STATE_PURPOSE,
      token: input.token,
      key: input.key,
    }),
  );
  if (!parsed.success) {
    throw new PrivateDataChatSignedStateError(
      "turn_state_invalid",
      "The prior-turn state is invalid.",
    );
  }

  const payload = parsed.data;
  const now = input.now ?? Date.now();
  if (
    payload.subject !==
      privateDataChatSubjectBinding({ ownerId: input.ownerId, key: input.key }) ||
    payload.conversationId !== input.conversationId ||
    payload.expiresAt <= now ||
    payload.issuedAt > now + 60_000 ||
    payload.semanticSnapshotChecksum !== (input.semanticSnapshotChecksum ?? null)
  ) {
    throw new PrivateDataChatSignedStateError(
      "turn_state_invalid",
      "The prior-turn state is invalid or expired.",
    );
  }

  return payload;
}
