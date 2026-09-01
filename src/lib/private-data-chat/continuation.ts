import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import {
  privateDataChatSubjectBinding,
  PrivateDataChatSignedStateError,
  signPrivateDataChatState,
  verifyPrivateDataChatState,
} from "@/lib/private-data-chat/signed-state";

export const PRIVATE_DATA_CHAT_CONTINUATION_TTL_MS = 15 * 60 * 1_000;
const CONTINUATION_PURPOSE = "rop-continuation";

const payloadSchema = z
  .object({
    version: z.literal(1),
    nonce: z.string().uuid(),
    subject: z.string().regex(/^[0-9a-f]{64}$/u),
    conversationId: z.string().uuid(),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    resourceKey: z.literal("rop-codes"),
    resourceVersionId: z.string().uuid(),
    resourceVersionChecksum: z.string().regex(/^[0-9a-f]{64}$/u),
    operation: z.enum(["search", "list"]),
    normalizedQuery: z.string().max(500).nullable(),
    ordering: z.literal("stable_key_ascending"),
    cursor: z.string().min(1).max(2_000),
    pageOffset: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(25),
  })
  .strict();

export type PrivateDataChatContinuationState = z.infer<typeof payloadSchema>;

export function createPrivateDataChatContinuationToken(input: {
  ownerId: string;
  conversationId: string;
  resourceVersionId: string;
  resourceVersionChecksum: string;
  operation: "search" | "list";
  normalizedQuery: string | null;
  cursor: string;
  pageOffset: number;
  limit: number;
  key: string;
  now?: number;
  ttlMs?: number;
  nonce?: string;
}) {
  const issuedAt = input.now ?? Date.now();
  const payload = payloadSchema.parse({
    version: 1,
    nonce: input.nonce ?? randomUUID(),
    subject: privateDataChatSubjectBinding({ ownerId: input.ownerId, key: input.key }),
    conversationId: input.conversationId,
    issuedAt,
    expiresAt: issuedAt + (input.ttlMs ?? PRIVATE_DATA_CHAT_CONTINUATION_TTL_MS),
    resourceKey: "rop-codes",
    resourceVersionId: input.resourceVersionId,
    resourceVersionChecksum: input.resourceVersionChecksum,
    operation: input.operation,
    normalizedQuery: input.normalizedQuery,
    ordering: "stable_key_ascending",
    cursor: input.cursor,
    pageOffset: input.pageOffset,
    limit: input.limit,
  });
  return signPrivateDataChatState({
    purpose: CONTINUATION_PURPOSE,
    payload,
    key: input.key,
  });
}

export function verifyPrivateDataChatContinuationToken(input: {
  token: string;
  ownerId: string;
  conversationId: string;
  resourceVersionId: string;
  resourceVersionChecksum: string;
  key: string;
  now?: number;
}) {
  const parsed = payloadSchema.safeParse(
    verifyPrivateDataChatState({
      purpose: CONTINUATION_PURPOSE,
      token: input.token,
      key: input.key,
    }),
  );
  if (!parsed.success) {
    throw new PrivateDataChatSignedStateError(
      "continuation_invalid",
      "The ROP continuation is invalid.",
    );
  }
  const state = parsed.data;
  const now = input.now ?? Date.now();
  if (
    state.subject !==
      privateDataChatSubjectBinding({ ownerId: input.ownerId, key: input.key }) ||
    state.conversationId !== input.conversationId ||
    state.resourceVersionId !== input.resourceVersionId ||
    state.resourceVersionChecksum !== input.resourceVersionChecksum ||
    state.expiresAt <= now ||
    state.issuedAt > now + 60_000
  ) {
    throw new PrivateDataChatSignedStateError(
      "continuation_invalid",
      "The ROP continuation is invalid, expired, or belongs to another context.",
    );
  }
  return state;
}

export function privateDataChatContinuationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function recordPrivateDataChatContinuationUse(input: {
  tokenHash: string;
  expiresAt: number;
}) {
  const rows = await getDb().execute<{ consumed: boolean }>(sql`
    select private.consume_analytics_chat_continuation_token(
      ${input.tokenHash},
      ${new Date(input.expiresAt)}::timestamptz
    ) as consumed
  `);
  return rows[0]?.consumed === true;
}

export async function consumePrivateDataChatContinuationToken(
  input: Parameters<typeof verifyPrivateDataChatContinuationToken>[0],
  dependencies: {
    recordUse?: typeof recordPrivateDataChatContinuationUse;
  } = {},
) {
  const state = verifyPrivateDataChatContinuationToken(input);
  const consumed = await (dependencies.recordUse ??
    recordPrivateDataChatContinuationUse)({
    tokenHash: privateDataChatContinuationTokenHash(input.token),
    expiresAt: state.expiresAt,
  });
  if (!consumed) {
    throw new PrivateDataChatSignedStateError(
      "continuation_replayed",
      "The ROP continuation was already used.",
    );
  }
  return state;
}
