import { createHash } from "node:crypto";

import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";

import { getDb } from "@/db";
import {
  apiConnectionRunLogs,
  apiConnectionRuns,
  apiConnections,
} from "@/db/schema";
import {
  checksumApiConnectionArtifact,
  parseApiConnectionRowsArtifact,
  serializeApiConnectionRowsArtifact,
  type ApiConnectionArtifactChunk,
} from "@/lib/api-connection-output";
import type { CsvColumn } from "@/lib/api-types";
import { createApiConnectionRunChunkStoragePath } from "@/lib/dataset-storage";
import { captureFailedApiConnectionRun } from "./failure-alerts";

import {
  downloadApiConnectionArtifactText,
  uploadApiConnectionRunChunk,
} from "./chunked-output";
import {
  ApiConnectionError,
  createApiConnectionRunRequest,
  parseApiResponseRows,
  previewResponse,
  redactSecrets,
} from "./core";
import {
  JOSHUA_PROJECT_API_CONNECTION_ID,
  applyCodeManagedDefinitionForExecution,
} from "./index";
import {
  JOSHUA_PROJECT_PAGE_SIZE,
  MAX_JOSHUA_PROJECT_PAGES,
  MAX_JOSHUA_PROJECT_RESPONSE_BYTES,
  fetchJoshuaProjectPeopleGroupPage,
} from "./providers/joshua-project";
import { readVaultSecret } from "./vault";

const DURABLE_RUN_DEADLINE_MS = 30 * 60 * 1_000;
export const DURABLE_RUN_STALE_MS = 2 * 60 * 1_000;

export class ApiConnectionRunCancelledError extends Error {
  constructor(message = "API connection run was cancelled.") {
    super(message);
    this.name = "ApiConnectionRunCancelledError";
  }
}

export type DurableJoshuaPageResult = {
  page: number;
  terminal: boolean;
  recordCount: number;
  totalRecords: number;
  totalBytes: number;
  httpStatus: number;
  fingerprint: string | null;
  columns: CsvColumn[];
  rawChunk: ApiConnectionArtifactChunk;
  rowsChunk: ApiConnectionArtifactChunk;
  responsePreview: string;
};

async function writeRunLog(input: {
  runId: string;
  connectionId: string;
  level?: "info" | "error";
  message: string;
}) {
  await getDb().insert(apiConnectionRunLogs).values({
    runId: input.runId,
    connectionId: input.connectionId,
    level: input.level ?? "info",
    message: input.message,
  });
}

export async function attachDurableJoshuaWorkflow(input: {
  runId: string;
  workflowRunId: string;
}) {
  const [run] = await getDb()
    .update(apiConnectionRuns)
    .set({ workflowRunId: input.workflowRunId })
    .where(
      and(
        eq(apiConnectionRuns.id, input.runId),
        inArray(apiConnectionRuns.status, ["queued", "running"]),
        or(
          isNull(apiConnectionRuns.workflowRunId),
          eq(apiConnectionRuns.workflowRunId, input.workflowRunId),
        ),
      ),
    )
    .returning();

  return run ?? null;
}

export async function claimDurableJoshuaRun(input: {
  runId: string;
  workflowRunId: string;
}) {
  const now = new Date();
  const [run] = await getDb()
    .update(apiConnectionRuns)
    .set({
      workflowRunId: input.workflowRunId,
      status: "running",
      stage: "fetching",
      heartbeatAt: now,
      deadlineAt: new Date(now.getTime() + DURABLE_RUN_DEADLINE_MS),
      startedAt: now,
      completedAt: null,
      cancelledAt: null,
      errorMessage: null,
      durationMs: 0,
    })
    .where(
      and(
        eq(apiConnectionRuns.id, input.runId),
        eq(apiConnectionRuns.connectionId, JOSHUA_PROJECT_API_CONNECTION_ID),
        inArray(apiConnectionRuns.status, ["queued", "running"]),
        or(
          isNull(apiConnectionRuns.workflowRunId),
          eq(apiConnectionRuns.workflowRunId, input.workflowRunId),
        ),
      ),
    )
    .returning();

  if (run) {
    await writeRunLog({
      runId: run.id,
      connectionId: run.connectionId,
      message: "Durable run started.",
    });
  }

  return run ?? null;
}

async function loadActiveJoshuaRun(runId: string) {
  const [record] = await getDb()
    .select({ run: apiConnectionRuns, connection: apiConnections })
    .from(apiConnectionRuns)
    .innerJoin(
      apiConnections,
      eq(apiConnections.id, apiConnectionRuns.connectionId),
    )
    .where(eq(apiConnectionRuns.id, runId))
    .limit(1);

  if (!record || record.run.connectionId !== JOSHUA_PROJECT_API_CONNECTION_ID) {
    throw new ApiConnectionError("Joshua Project run was not found.", 404);
  }
  if (
    record.run.status === "cancelled" ||
    record.run.cancelRequestedAt !== null
  ) {
    throw new ApiConnectionRunCancelledError();
  }
  if (record.run.status !== "running") {
    throw new ApiConnectionError("Joshua Project run is no longer active.", 409);
  }
  if (record.run.deadlineAt && record.run.deadlineAt.getTime() <= Date.now()) {
    throw new ApiConnectionError("Joshua Project run exceeded its deadline.", 504);
  }
  if (record.connection.archivedAt) {
    throw new ApiConnectionError(
      "API connection was disconnected before execution.",
      409,
    );
  }

  return record;
}

export async function executeDurableJoshuaPage(input: {
  runId: string;
  page: number;
  priorFingerprints: string[];
}) {
  if (input.page > MAX_JOSHUA_PROJECT_PAGES) {
    throw new ApiConnectionError(
      `Joshua Project API response exceeded ${MAX_JOSHUA_PROJECT_PAGES} pages.`,
      502,
    );
  }

  const { run, connection } = await loadActiveJoshuaRun(input.runId);

  if (run.pagesCompleted >= input.page) {
    const rawPath = createApiConnectionRunChunkStoragePath({
      runId: run.id,
      kind: "raw",
      page: input.page,
    });
    const rowsPath = createApiConnectionRunChunkStoragePath({
      runId: run.id,
      kind: "rows",
      page: input.page,
    });
    const [rawContent, rowsContent] = await Promise.all([
      downloadApiConnectionArtifactText(rawPath),
      downloadApiConnectionArtifactText(rowsPath),
    ]);
    const records = JSON.parse(rawContent) as unknown;
    if (!Array.isArray(records)) {
      throw new ApiConnectionError(
        `Retained Joshua Project page ${input.page} is invalid.`,
        502,
      );
    }
    const artifact = parseApiConnectionRowsArtifact(rowsContent);
    const fingerprint =
      records.length === 0
        ? null
        : createHash("sha256").update(rawContent).digest("hex");

    return {
      page: input.page,
      terminal: records.length < JOSHUA_PROJECT_PAGE_SIZE,
      recordCount: records.length,
      totalRecords: run.recordsCompleted,
      totalBytes: run.bytesProcessed,
      httpStatus: run.httpStatus ?? 200,
      fingerprint,
      columns: artifact.columns,
      rawChunk: {
        page: input.page,
        path: rawPath,
        rowCount: records.length,
        sizeBytes: Buffer.byteLength(rawContent),
        checksum: checksumApiConnectionArtifact(rawContent),
      },
      rowsChunk: {
        page: input.page,
        path: rowsPath,
        rowCount: artifact.rows.length,
        sizeBytes: Buffer.byteLength(rowsContent),
        checksum: checksumApiConnectionArtifact(rowsContent),
      },
      responsePreview: previewResponse(rawContent, new Map()),
    } satisfies DurableJoshuaPageResult;
  }

  const executableConnection = applyCodeManagedDefinitionForExecution(connection);
  const secrets = await readVaultSecret(executableConnection.secretVaultId);
  const request = createApiConnectionRunRequest({
    method: executableConnection.method,
    url: executableConnection.url,
    requestHeaders: executableConnection.requestHeaders,
    bodyTemplate: executableConnection.bodyTemplate,
    secrets,
  });
  const page = await fetchJoshuaProjectPeopleGroupPage({
    url: request.url,
    headers: request.headers,
    page: input.page,
    pageSize: JOSHUA_PROJECT_PAGE_SIZE,
  });

  if (page.fingerprint && input.priorFingerprints.includes(page.fingerprint)) {
    throw new ApiConnectionError(
      `Joshua Project API repeated page ${input.page}.`,
      502,
    );
  }

  const totalBytes = run.bytesProcessed + page.byteLength;
  if (totalBytes > MAX_JOSHUA_PROJECT_RESPONSE_BYTES) {
    throw new ApiConnectionError(
      "Joshua Project aggregate response is too large.",
      502,
    );
  }

  const parsed = parseApiResponseRows({
    body: page.body,
    responseFormat: executableConnection.responseFormat,
    responseDataPath: executableConnection.responseDataPath,
    connectionUrl: executableConnection.url,
  });
  const [rawChunk, rowsChunk] = await Promise.all([
    uploadApiConnectionRunChunk({
      runId: run.id,
      kind: "raw",
      page: input.page,
      rowCount: page.recordCount,
      content: redactSecrets(page.body, secrets),
    }),
    uploadApiConnectionRunChunk({
      runId: run.id,
      kind: "rows",
      page: input.page,
      rowCount: parsed.rows.length,
      content: serializeApiConnectionRowsArtifact(parsed),
    }),
  ]);
  const now = new Date();
  const totalRecords = run.recordsCompleted + parsed.rows.length;
  const [checkpointed] = await getDb()
    .update(apiConnectionRuns)
    .set({
      stage: page.terminal ? "finalizing" : "fetching",
      heartbeatAt: now,
      pagesCompleted: input.page,
      recordsCompleted: totalRecords,
      bytesProcessed: totalBytes,
      httpStatus: page.httpStatus,
      responsePreview: previewResponse(page.body, secrets),
      durationMs: run.startedAt ? now.getTime() - run.startedAt.getTime() : 0,
    })
    .where(
      and(
        eq(apiConnectionRuns.id, run.id),
        eq(apiConnectionRuns.status, "running"),
        isNull(apiConnectionRuns.cancelRequestedAt),
        eq(apiConnectionRuns.pagesCompleted, input.page - 1),
      ),
    )
    .returning();

  if (!checkpointed && run.pagesCompleted < input.page) {
    throw new ApiConnectionRunCancelledError(
      "Joshua Project run stopped before the page checkpoint completed.",
    );
  }
  if (checkpointed) {
    await writeRunLog({
      runId: run.id,
      connectionId: run.connectionId,
      message: `Fetched Joshua Project page ${input.page}: ${page.recordCount} records (${totalRecords} total).`,
    });
  }

  return {
    page: input.page,
    terminal: page.terminal,
    recordCount: page.recordCount,
    totalRecords,
    totalBytes,
    httpStatus: page.httpStatus,
    fingerprint: page.fingerprint,
    columns: parsed.columns,
    rawChunk,
    rowsChunk,
    responsePreview: previewResponse(page.body, secrets),
  } satisfies DurableJoshuaPageResult;
}

export async function failDurableJoshuaRun(input: {
  runId: string;
  message: string;
}) {
  const now = new Date();
  const [run] = await getDb()
    .update(apiConnectionRuns)
    .set({
      status: "failed",
      stage: "failed",
      heartbeatAt: now,
      completedAt: now,
      errorMessage: input.message,
    })
    .where(
      and(
        eq(apiConnectionRuns.id, input.runId),
        inArray(apiConnectionRuns.status, ["queued", "running"]),
      ),
    )
    .returning();

  if (run) {
    await writeRunLog({
      runId: run.id,
      connectionId: run.connectionId,
      level: "error",
      message: input.message,
    });
    await captureFailedApiConnectionRun({
      connectionId: run.connectionId,
      runId: run.id,
      mode: run.mode === "test" ? "test" : "import",
      reasonCode: "durable-source-failed",
    });
  }
  return run ?? null;
}

export async function cancelApiConnectionRun(input: {
  connectionId: string;
  runId: string;
}) {
  const now = new Date();
  const [run] = await getDb()
    .update(apiConnectionRuns)
    .set({
      status: "cancelled",
      stage: "cancelled",
      cancelRequestedAt: now,
      cancelledAt: now,
      completedAt: now,
      heartbeatAt: now,
      errorMessage: "Run cancelled by an administrator.",
    })
    .where(
      and(
        eq(apiConnectionRuns.id, input.runId),
        eq(apiConnectionRuns.connectionId, input.connectionId),
        inArray(apiConnectionRuns.status, ["queued", "running"]),
      ),
    )
    .returning();

  if (run) {
    await writeRunLog({
      runId: run.id,
      connectionId: run.connectionId,
      level: "info",
      message: "Run cancelled by an administrator.",
    });
  }

  return run ?? null;
}

export async function reconcileStaleApiConnectionRuns(input?: {
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const staleBefore = new Date(now.getTime() - DURABLE_RUN_STALE_MS);
  const staleRuns = await getDb()
    .update(apiConnectionRuns)
    .set({
      status: "failed",
      stage: "failed",
      completedAt: now,
      errorMessage:
        "Durable run stopped reporting progress and was safely closed.",
    })
    .where(
      and(
        eq(apiConnectionRuns.connectionId, JOSHUA_PROJECT_API_CONNECTION_ID),
        inArray(apiConnectionRuns.status, ["queued", "running"]),
        or(
          lt(apiConnectionRuns.deadlineAt, now),
          lt(apiConnectionRuns.heartbeatAt, staleBefore),
          and(
            eq(apiConnectionRuns.status, "queued"),
            lt(apiConnectionRuns.createdAt, staleBefore),
          ),
          and(
            eq(apiConnectionRuns.status, "running"),
            isNull(apiConnectionRuns.heartbeatAt),
            lt(apiConnectionRuns.startedAt, staleBefore),
          ),
        ),
      ),
    )
    .returning();

  for (const run of staleRuns) {
    await writeRunLog({
      runId: run.id,
      connectionId: run.connectionId,
      level: "error",
      message: run.errorMessage!,
    });
    await captureFailedApiConnectionRun({
      connectionId: run.connectionId,
      runId: run.id,
      mode: run.mode === "test" ? "test" : "import",
      reasonCode: "stale-run",
    });
  }

  return staleRuns.length;
}
