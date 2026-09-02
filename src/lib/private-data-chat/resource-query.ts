import { randomUUID } from "node:crypto";

import type { CurrentIdentity } from "@/lib/auth";
import {
  appendPrivateDataChatAudit,
  pseudonymizePrivateDataChatOwner,
} from "@/lib/private-data-chat/broker";
import { PRIVATE_DATA_CHAT_CATALOG_VERSION } from "@/lib/private-data-chat/catalog";
import { PRIVATE_DATA_CHAT_POLICY_VERSION } from "@/lib/private-data-chat/compiler";
import {
  consumePrivateDataChatContinuationToken,
  createPrivateDataChatContinuationToken,
} from "@/lib/private-data-chat/continuation";
import {
  PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS,
  privateDataChatResourceQueryResultSchema,
  type PrivateDataChatResourceQuery,
  type PrivateDataChatResourceQueryResult,
} from "@/lib/private-data-chat/schemas";
import {
  PRIVATE_QWEN_MODEL_SHA256,
  PRIVATE_QWEN_RUNTIME_REVISION,
} from "@/lib/private-data-chat/prompts";
import type { PrivateDataChatRetrievalAudit } from "@/lib/private-data-chat/retrieval";
import {
  countReferenceResourceEntries,
  getActiveReferenceResource,
  queryReferenceResourceEntries,
} from "@/lib/reference-resources";
import { ROP_RESOURCE_KEY } from "@/lib/reference-resources/types";
import type { RopCodeEntry, RopCodeResource } from "@/lib/rop-codes";

export class PrivateDataChatResourceQueryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PrivateDataChatResourceQueryError";
    this.code = code;
  }
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function exactEntryMatches(entry: RopCodeEntry, lookup: string) {
  const values = [
    entry.id,
    entry.rop1?.code,
    entry.rop1?.name,
    entry.rop2?.code,
    entry.rop2?.name,
    entry.rop25?.code,
    entry.rop25?.name,
    entry.rop3?.code,
    entry.rop3?.name,
  ].filter((value): value is string => Boolean(value));
  return values.some((value) => normalize(value) === lookup);
}

function exactMatches(entries: readonly RopCodeEntry[], lookup: string) {
  const normalized = normalize(lookup);
  return entries
    .filter((entry) => exactEntryMatches(entry, normalized))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function withBoundedGeographies(
  entry: RopCodeEntry,
  resource: RopCodeResource,
) {
  const geographies = entry.rop3
    ? (resource.geoIndexByRop3 ?? {})[entry.rop3.code] ?? []
    : [];
  return {
    ...entry,
    geographyCount: geographies.length,
    geographies: geographies.slice(0, PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS),
    geographiesTruncated:
      geographies.length > PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS,
  };
}

function exportUrl(search: string | null) {
  if (!search) return "/api/reference-resources/rop-codes/download";
  return `/api/reference-resources/rop-codes/download?${new URLSearchParams({
    search,
  }).toString()}`;
}

export type PrivateDataChatResourceQueryDependencies = {
  getActive: typeof getActiveReferenceResource;
  queryEntries: typeof queryReferenceResourceEntries;
  countEntries: typeof countReferenceResourceEntries;
  consumeContinuation: typeof consumePrivateDataChatContinuationToken;
  createContinuation: typeof createPrivateDataChatContinuationToken;
  appendAudit: typeof appendPrivateDataChatAudit;
  createQueryId: () => string;
  now: () => number;
  pseudonymize: typeof pseudonymizePrivateDataChatOwner;
};

export async function executePrivateDataChatResourceQuery(input: {
  identity: CurrentIdentity;
  conversationId: string;
  resourceQuery: PrivateDataChatResourceQuery;
  continuationKey: string;
  now?: number;
  retrievalAudit?: PrivateDataChatRetrievalAudit | null;
  dependencies?: Partial<PrivateDataChatResourceQueryDependencies>;
}): Promise<PrivateDataChatResourceQueryResult> {
  const dependencies: PrivateDataChatResourceQueryDependencies = {
    getActive: getActiveReferenceResource,
    queryEntries: queryReferenceResourceEntries,
    countEntries: countReferenceResourceEntries,
    consumeContinuation: consumePrivateDataChatContinuationToken,
    createContinuation: createPrivateDataChatContinuationToken,
    appendAudit: appendPrivateDataChatAudit,
    createQueryId: randomUUID,
    now: () => Date.now(),
    pseudonymize: pseudonymizePrivateDataChatOwner,
    ...input.dependencies,
  };
  if (!input.identity.isDatasetAdmin) {
    throw new PrivateDataChatResourceQueryError(
      "resource_forbidden",
      "ROP chat browsing is unavailable for this identity.",
    );
  }
  if (!input.conversationId) {
    throw new PrivateDataChatResourceQueryError(
      "conversation_required",
      "A conversation identifier is required for bounded ROP paging.",
    );
  }
  if (input.continuationKey.length < 32) {
    throw new PrivateDataChatResourceQueryError(
      "continuation_unavailable",
      "ROP continuation signing is unavailable.",
    );
  }

  const active = await dependencies.getActive(ROP_RESOURCE_KEY);
  const checksum = active.version.contentChecksum;
  if (!checksum) {
    throw new PrivateDataChatResourceQueryError(
      "resource_version_invalid",
      "The active ROP version has no verified checksum.",
    );
  }
  const auditQueryId = dependencies.createQueryId();
  const pseudonymousUserId = dependencies.pseudonymize(input.identity.ownerId);
  const auditStartedAt = dependencies.now();

  async function complete(result: PrivateDataChatResourceQueryResult) {
    await dependencies.appendAudit({
      queryId: auditQueryId,
      pseudonymousUserId,
      catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
      policyVersion: PRIVATE_DATA_CHAT_POLICY_VERSION,
      modelSha256: PRIVATE_QWEN_MODEL_SHA256,
      runtimeRevision: PRIVATE_QWEN_RUNTIME_REVISION,
      decision: "executed",
      reasonCode: "resource_query_executed",
      referencedView: "private.pipeline_reference_entries",
      sqlTemplate: null,
      elapsedMs: Math.max(0, dependencies.now() - auditStartedAt),
      rowCount: result.returnedCount,
      matchingCount: result.matchingCount,
      requestedLimit: result.requestedLimit,
      queryMode: "resource",
      namedFilterKeys: [],
      resourceKey: result.resourceKey,
      resourceOperation: result.operation,
      resourceVersionId: result.resourceVersion.id,
      retrievalAudience: input.retrievalAudit?.audience ?? null,
      semanticSnapshotChecksum:
        input.retrievalAudit?.semanticSnapshotChecksum ?? null,
      retrievalPolicyChecksum:
        input.retrievalAudit?.retrievalPolicyChecksum ?? null,
      retrievalTier: input.retrievalAudit?.retrievalTier ?? null,
      retrievedCardKeys: input.retrievalAudit?.selectedCardKeys ?? [],
      retrievedCardChecksums:
        input.retrievalAudit?.selectedCardChecksums ?? [],
      retrievalLatencyMs: input.retrievalAudit?.latencyMs ?? null,
      contextBytes: input.retrievalAudit?.contextBytes ?? null,
      responseBytes: Buffer.byteLength(JSON.stringify(result), "utf8"),
    });
    return result;
  }

  const operation = input.resourceQuery.operation;
  let underlyingOperation: "search" | "list" =
    operation === "search" ||
    (operation === "count" && Boolean(input.resourceQuery.query))
      ? "search"
      : "list";
  let normalizedQuery = input.resourceQuery.query
    ? normalize(input.resourceQuery.query)
    : null;
  let cursor: string | null = null;
  let pageOffset = 0;
  let limit = Math.min(
    input.resourceQuery.limit,
    PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS,
  );

  if (operation === "continue") {
    const state = await dependencies.consumeContinuation({
      token: input.resourceQuery.continuationToken!,
      ownerId: input.identity.ownerId,
      conversationId: input.conversationId,
      resourceVersionId: active.version.id,
      resourceVersionChecksum: checksum,
      key: input.continuationKey,
      now: input.now,
    });
    underlyingOperation = state.operation;
    normalizedQuery = state.normalizedQuery;
    cursor = state.cursor;
    pageOffset = state.pageOffset;
    limit = state.limit;
  }

  const resourceVersion = {
    id: active.version.id,
    versionNumber: active.version.versionNumber,
    contentChecksum: checksum,
  };
  const base = {
    resourceKey: ROP_RESOURCE_KEY,
    operation,
    normalizedQuery,
    requestedLimit: limit,
    pageOffset,
    resourceVersion,
    ambiguityChoices: [] as RopCodeEntry[],
    exportUrl: exportUrl(normalizedQuery),
  };

  const lookup =
    operation === "lookup"
      ? input.resourceQuery.lookupKey
      : operation === "search" && !cursor
        ? input.resourceQuery.query
        : null;
  if (lookup) {
    const matches = exactMatches(active.payload.entries, lookup);
    if (matches.length > 1) {
      const choices = matches
        .slice(0, PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS)
        .map((entry) => withBoundedGeographies(entry, active.payload));
      return complete(privateDataChatResourceQueryResultSchema.parse({
        ...base,
        normalizedQuery: normalize(lookup),
        returnedCount: 0,
        matchingCount: choices.length,
        hasMore: false,
        entries: [],
        ambiguityChoices: choices,
        continuationToken: null,
        exportUrl: exportUrl(normalize(lookup)),
      }));
    }
    if (matches.length === 1 || operation === "lookup") {
      const entries = matches
        .slice(0, 1)
        .map((entry) => withBoundedGeographies(entry, active.payload));
      return complete(privateDataChatResourceQueryResultSchema.parse({
        ...base,
        normalizedQuery: normalize(lookup),
        returnedCount: entries.length,
        matchingCount: entries.length,
        hasMore: false,
        entries,
        continuationToken: null,
        exportUrl: exportUrl(normalize(lookup)),
      }));
    }
  }

  const search = underlyingOperation === "search" ? normalizedQuery ?? undefined : undefined;
  const matchingCount = await dependencies.countEntries({
    resourceKey: ROP_RESOURCE_KEY,
    search,
    versionId: active.version.id,
  });
  if (operation === "count") {
    return complete(privateDataChatResourceQueryResultSchema.parse({
      ...base,
      returnedCount: 0,
      matchingCount,
      hasMore: false,
      entries: [],
      continuationToken: null,
    }));
  }

  const page = await dependencies.queryEntries({
    resourceKey: ROP_RESOURCE_KEY,
    search,
    cursor,
    limit,
    versionId: active.version.id,
  });
  const entries = (page.entries as RopCodeEntry[]).map((entry) =>
    withBoundedGeographies(entry, active.payload),
  );
  const hasMore = Boolean(page.nextCursor);
  const continuationToken =
    hasMore && page.nextCursor
      ? dependencies.createContinuation({
          ownerId: input.identity.ownerId,
          conversationId: input.conversationId,
          resourceVersionId: active.version.id,
          resourceVersionChecksum: checksum,
          operation: underlyingOperation,
          normalizedQuery,
          cursor: page.nextCursor,
          pageOffset: pageOffset + entries.length,
          limit,
          key: input.continuationKey,
          now: input.now,
        })
      : null;

  return complete(privateDataChatResourceQueryResultSchema.parse({
    ...base,
    returnedCount: entries.length,
    matchingCount,
    hasMore,
    entries,
    continuationToken,
  }));
}

export function renderPrivateDataChatResourceResult(
  result: PrivateDataChatResourceQueryResult,
) {
  if (result.ambiguityChoices.length > 0) {
    return {
      content: `That ROP value has ${result.ambiguityChoices.length} exact matches. Choose a code or full name to continue.`,
      facts: result.ambiguityChoices.map((entry) =>
        [entry.rop3?.display, entry.rop25?.display, entry.rop2?.display]
          .filter(Boolean)
          .join(" · "),
      ),
    };
  }
  if (result.operation === "count") {
    return {
      content: `${result.matchingCount.toLocaleString()} ROP entries match.`,
      facts: [`ROP entry count: ${result.matchingCount.toLocaleString()}`],
    };
  }
  const start = result.returnedCount > 0 ? result.pageOffset + 1 : 0;
  const end = result.pageOffset + result.returnedCount;
  const content = result.hasMore
    ? `${result.matchingCount.toLocaleString()} ROP entries match; showing ${start.toLocaleString()}–${end.toLocaleString()}.`
    : result.pageOffset > 0
      ? `${result.matchingCount.toLocaleString()} ROP entries match; showing the final ${start.toLocaleString()}–${end.toLocaleString()}.`
      : `${result.matchingCount.toLocaleString()} ROP entries match.`;
  return {
    content,
    facts: result.entries.map((entry) =>
      [
        entry.rop3?.display ?? entry.rop25?.display ?? entry.id,
        entry.rop2?.display,
        entry.rop1?.display,
        entry.status,
        entry.joinIssueLabel,
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  };
}
