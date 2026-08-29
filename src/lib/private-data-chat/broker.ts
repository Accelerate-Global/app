import { createHmac, randomUUID } from "node:crypto";

import { sql as drizzleSql } from "drizzle-orm";

import { getDb } from "@/db";
import type { CurrentIdentity } from "@/lib/auth";
import { PRIVATE_DATA_CHAT_DATASET_KEY } from "@/lib/private-data-chat/catalog";
import { getPrivateDataChatAnalyticsSql } from "@/lib/private-data-chat/analytics-db";
import type { CompiledPrivateDataChatQuery } from "@/lib/private-data-chat/compiler";
import { getPrivateDataChatConfiguration } from "@/lib/private-data-chat/config";
import {
  PRIVATE_DATA_CHAT_MAX_RESULT_BYTES,
  privateDataChatQueryResultSchema,
  type PrivateDataChatQueryResult,
} from "@/lib/private-data-chat/schemas";
import {
  PRIVATE_QWEN_MODEL_SHA256,
  PRIVATE_QWEN_RUNTIME_REVISION,
} from "@/lib/private-data-chat/prompts";

const PRIVATE_DATA_CHAT_MAX_ESTIMATED_COST = 100_000;

export type PrivateDataChatAuditDecision =
  | "admitted"
  | "rejected"
  | "executed"
  | "failed";

export type PrivateDataChatAuditEvent = {
  queryId: string;
  pseudonymousUserId: string;
  catalogVersion: string;
  policyVersion: string;
  modelSha256: string;
  runtimeRevision: string;
  decision: PrivateDataChatAuditDecision;
  reasonCode: string;
  referencedView: string | null;
  sqlTemplate: string | null;
  elapsedMs: number | null;
  rowCount: number | null;
  responseBytes: number | null;
};

export class PrivateDataChatBrokerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PrivateDataChatBrokerError";
    this.code = code;
  }
}

type ReadOnlyQueryOutput = {
  rows: Array<Record<string, unknown>>;
  datasetId: string | null;
  datasetVersionCreatedAt: string | null;
};

export type PrivateDataChatBrokerDependencies = {
  runReadOnlyQuery: (
    identity: CurrentIdentity,
    compiled: CompiledPrivateDataChatQuery,
  ) => Promise<ReadOnlyQueryOutput>;
  appendAudit: (event: PrivateDataChatAuditEvent) => Promise<void>;
  now: () => number;
  createQueryId: () => string;
  pseudonymize: (ownerId: string) => string;
};

function getPlanTotalCost(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const first = value[0];
  if (!first || typeof first !== "object") {
    return null;
  }

  const plan = (first as Record<string, unknown>).Plan;
  if (!plan || typeof plan !== "object") {
    return null;
  }

  const totalCost = (plan as Record<string, unknown>)["Total Cost"];
  return typeof totalCost === "number" ? totalCost : null;
}

async function runProductionReadOnlyQuery(
  identity: CurrentIdentity,
  compiled: CompiledPrivateDataChatQuery,
): Promise<ReadOnlyQueryOutput> {
  const sql = getPrivateDataChatAnalyticsSql();
  const claims = JSON.stringify({
    sub: identity.ownerId,
    role: "authenticated",
    app_metadata: { workspace_role: identity.workspaceRole },
  });

  return sql.begin("read only", async (transaction) => {
    await transaction`select set_config('request.jwt.claims', ${claims}, true)`;
    await transaction.unsafe("set local role analytics_chat_reader");
    await transaction.unsafe("set local statement_timeout = '5s'");
    await transaction.unsafe("set local lock_timeout = '500ms'");
    await transaction.unsafe(
      "set local idle_in_transaction_session_timeout = '5s'",
    );
    await transaction.unsafe("set local work_mem = '16MB'");

    const metadataRows = await transaction<
      { dataset_id: string; dataset_version_created_at: Date | string }[]
    >`
      select dataset_id, dataset_version_created_at
      from analytics_ro.primary_people_groups
      limit 1
    `;
    const explainRows = await transaction.unsafe(
      `explain (format json) ${compiled.text}`,
      compiled.parameters,
    );
    const explainValue = (explainRows[0] as Record<string, unknown> | undefined)?.[
      "QUERY PLAN"
    ];
    const totalCost = getPlanTotalCost(explainValue);

    if (totalCost === null || totalCost > PRIVATE_DATA_CHAT_MAX_ESTIMATED_COST) {
      throw new PrivateDataChatBrokerError(
        "query_cost_exceeded",
        "The query exceeds the private analytics cost policy.",
      );
    }

    const rows = (await transaction.unsafe(
      compiled.text,
      compiled.parameters,
    )) as unknown as Array<Record<string, unknown>>;
    const responseBytes = Buffer.byteLength(JSON.stringify(rows), "utf8");

    if (responseBytes > PRIVATE_DATA_CHAT_MAX_RESULT_BYTES) {
      throw new PrivateDataChatBrokerError(
        "result_too_large",
        "The private analytics result exceeds the response-size policy.",
      );
    }

    const metadata = metadataRows[0];
    return {
      rows: [...rows],
      datasetId: metadata?.dataset_id ?? null,
      datasetVersionCreatedAt: metadata?.dataset_version_created_at
        ? new Date(metadata.dataset_version_created_at).toISOString()
        : null,
    };
  });
}

async function appendProductionAudit(event: PrivateDataChatAuditEvent) {
  await getDb().execute(drizzleSql`
    insert into private.analytics_chat_audit (
      query_id,
      pseudonymous_user_id,
      catalog_version,
      policy_version,
      model_sha256,
      runtime_revision,
      decision,
      reason_code,
      referenced_view,
      sql_template,
      elapsed_ms,
      row_count,
      response_bytes
    ) values (
      ${event.queryId}::uuid,
      ${event.pseudonymousUserId},
      ${event.catalogVersion},
      ${event.policyVersion},
      ${event.modelSha256},
      ${event.runtimeRevision},
      ${event.decision},
      ${event.reasonCode},
      ${event.referencedView},
      ${event.sqlTemplate},
      ${event.elapsedMs},
      ${event.rowCount},
      ${event.responseBytes}
    )
  `);
}

function productionPseudonymize(ownerId: string) {
  const key = getPrivateDataChatConfiguration().auditHmacKey;

  if (!key || key.length < 32) {
    throw new PrivateDataChatBrokerError(
      "audit_not_configured",
      "Private data chat audit configuration is unavailable.",
    );
  }

  return createHmac("sha256", key).update(ownerId).digest("hex");
}

const productionDependencies: PrivateDataChatBrokerDependencies = {
  runReadOnlyQuery: runProductionReadOnlyQuery,
  appendAudit: appendProductionAudit,
  now: () => Date.now(),
  createQueryId: randomUUID,
  pseudonymize: productionPseudonymize,
};

function stableFailureCode(error: unknown) {
  if (error instanceof PrivateDataChatBrokerError) {
    return error.code;
  }

  return "query_failed";
}

export async function executePrivateDataChatQuery(input: {
  identity: CurrentIdentity;
  compiled: CompiledPrivateDataChatQuery;
  dependencies?: PrivateDataChatBrokerDependencies;
}): Promise<PrivateDataChatQueryResult> {
  const dependencies = input.dependencies ?? productionDependencies;
  const queryId = dependencies.createQueryId();
  const pseudonymousUserId = dependencies.pseudonymize(input.identity.ownerId);
  const startedAt = dependencies.now();

  try {
    const output = await dependencies.runReadOnlyQuery(
      input.identity,
      input.compiled,
    );
    const elapsedMs = Math.max(0, dependencies.now() - startedAt);
    const responseBytes = Buffer.byteLength(JSON.stringify(output.rows), "utf8");
    const result = privateDataChatQueryResultSchema.parse({
      rows: output.rows,
      provenance: {
        queryId,
        catalogVersion: input.compiled.catalogVersion,
        dataset: PRIVATE_DATA_CHAT_DATASET_KEY,
        datasetId: output.datasetId,
        datasetVersionCreatedAt: output.datasetVersionCreatedAt,
        rowCount: output.rows.length,
        filters: input.compiled.query.filters.map((filter) => ({
          field: filter.field,
          operator: filter.operator,
        })),
      },
    });

    await dependencies.appendAudit({
      queryId,
      pseudonymousUserId,
      catalogVersion: input.compiled.catalogVersion,
      policyVersion: input.compiled.policyVersion,
      modelSha256: PRIVATE_QWEN_MODEL_SHA256,
      runtimeRevision: PRIVATE_QWEN_RUNTIME_REVISION,
      decision: "executed",
      reasonCode: "query_executed",
      referencedView: "analytics_ro.primary_people_groups",
      sqlTemplate: input.compiled.text,
      elapsedMs,
      rowCount: output.rows.length,
      responseBytes,
    });

    return result;
  } catch (error) {
    await dependencies.appendAudit({
      queryId,
      pseudonymousUserId,
      catalogVersion: input.compiled.catalogVersion,
      policyVersion: input.compiled.policyVersion,
      modelSha256: PRIVATE_QWEN_MODEL_SHA256,
      runtimeRevision: PRIVATE_QWEN_RUNTIME_REVISION,
      decision: "failed",
      reasonCode: stableFailureCode(error),
      referencedView: "analytics_ro.primary_people_groups",
      sqlTemplate: input.compiled.text,
      elapsedMs: Math.max(0, dependencies.now() - startedAt),
      rowCount: null,
      responseBytes: null,
    });

    if (error instanceof PrivateDataChatBrokerError) {
      throw error;
    }

    throw new PrivateDataChatBrokerError(
      "query_failed",
      "The private analytics query could not be completed.",
    );
  }
}
