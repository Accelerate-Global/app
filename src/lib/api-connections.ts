import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import Papa from "papaparse";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { apiConnectionRuns, apiConnections } from "@/db/schema";
import type { CurrentIdentity } from "@/lib/auth";
import { chunkRows, normalizeHeaders, sanitizeFileName } from "@/lib/csv";
import {
  createDataset,
  insertDatasetRowBatch,
  replaceDatasetContents,
} from "@/lib/datasets";
import {
  createDatasetStoragePath,
  getDatasetStorageBucket,
} from "@/lib/dataset-storage";
import { logError } from "@/lib/error-logging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ApiConnection,
  ApiConnectionHeader,
  ApiConnectionImportMode,
  ApiConnectionResponseFormat,
  ApiConnectionRun,
  ApiConnectionRunMode,
  ApiConnectionRunStatus,
  CsvColumn,
  DatasetClassification,
  DatasetSummary,
} from "@/lib/api-types";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_PREVIEW_LENGTH = 8 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

type ApiConnectionRecord = typeof apiConnections.$inferSelect;
type ApiConnectionRunRecord = typeof apiConnectionRuns.$inferSelect;

export type ApiConnectionInput = {
  name: string;
  description: string;
  method: ApiConnection["method"];
  url: string;
  headers: ApiConnectionHeader[];
  bodyTemplate: string;
  responseFormat: ApiConnectionResponseFormat;
  responseDataPath: string;
  importMode: ApiConnectionImportMode;
  targetDatasetId: string | null;
  datasetName: string;
  datasetClassification: DatasetClassification;
};

export class ApiConnectionError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiConnectionError";
    this.status = status;
  }
}

function toApiConnection(row: ApiConnectionRecord): ApiConnection {
  const nonSecretHeaders = row.requestHeaders.map((header) => ({
    name: header.name,
    value: header.value,
    isSecret: false,
  }));
  const secretHeaders = row.secretHeaderNames.map((name) => ({
    name,
    value: "",
    isSecret: true,
  }));

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    method: row.method,
    url: row.url,
    headers: [...nonSecretHeaders, ...secretHeaders],
    bodyTemplate: row.bodyTemplate,
    responseFormat: row.responseFormat,
    responseDataPath: row.responseDataPath,
    importMode: row.importMode,
    targetDatasetId: row.targetDatasetId,
    datasetName: row.datasetName,
    datasetClassification: row.datasetClassification,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toApiConnectionRun(row: ApiConnectionRunRecord): ApiConnectionRun {
  return {
    id: row.id,
    connectionId: row.connectionId,
    actorOwnerId: row.actorOwnerId,
    actorEmail: row.actorEmail,
    mode: row.mode,
    status: row.status,
    httpStatus: row.httpStatus,
    durationMs: row.durationMs,
    rowCount: row.rowCount,
    datasetId: row.datasetId,
    errorMessage: row.errorMessage,
    responsePreview: row.responsePreview,
    createdAt: row.createdAt.toISOString(),
  };
}

function normalizeConnectionInput(input: ApiConnectionInput) {
  const nonSecretHeaders: ApiConnectionHeader[] = [];
  const secretHeaders = new Map<string, string>();

  for (const header of input.headers) {
    const name = header.name.trim();
    const value = header.value;

    if (header.isSecret) {
      secretHeaders.set(name, value);
    } else {
      nonSecretHeaders.push({ name, value, isSecret: false });
    }
  }

  return {
    ...input,
    name: input.name.trim(),
    description: input.description.trim(),
    url: input.url.trim(),
    bodyTemplate: input.bodyTemplate,
    responseDataPath: input.responseDataPath.trim(),
    targetDatasetId: input.importMode === "replace" ? input.targetDatasetId : null,
    datasetName: sanitizeFileName(input.datasetName),
    nonSecretHeaders,
    secretHeaders,
  };
}

function getVaultSecretName(connectionId: string) {
  return `api_connection_${connectionId}_headers`;
}

async function createVaultSecret(connectionId: string, secretHeaders: Map<string, string>) {
  if (secretHeaders.size === 0) {
    return null;
  }

  const secret = JSON.stringify(Object.fromEntries(secretHeaders));
  const rows = (await getDb().execute(sql`
    select vault.create_secret(
      ${secret},
      ${getVaultSecretName(connectionId)},
      'API connection secret headers'
    ) as id
  `)) as Array<{ id: string }>;

  return rows[0]?.id ?? null;
}

async function updateVaultSecret(input: {
  connectionId: string;
  vaultId: string | null;
  secretHeaders: Map<string, string>;
}) {
  if (input.secretHeaders.size === 0) {
    return null;
  }

  const secret = JSON.stringify(Object.fromEntries(input.secretHeaders));

  if (input.vaultId) {
    await getDb().execute(sql`
      select vault.update_secret(
        ${input.vaultId}::uuid,
        ${secret},
        ${getVaultSecretName(input.connectionId)},
        'API connection secret headers'
      )
    `);
    return input.vaultId;
  }

  return createVaultSecret(input.connectionId, input.secretHeaders);
}

async function readVaultSecret(vaultId: string | null) {
  if (!vaultId) {
    return new Map<string, string>();
  }

  const rows = (await getDb().execute(sql`
    select decrypted_secret
    from vault.decrypted_secrets
    where id = ${vaultId}::uuid
    limit 1
  `)) as Array<{ decrypted_secret: string | null }>;
  const rawSecret = rows[0]?.decrypted_secret;

  if (!rawSecret) {
    return new Map<string, string>();
  }

  try {
    const parsed = JSON.parse(rawSecret) as Record<string, unknown>;
    return new Map(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .map(([name, value]) => [name, value]),
    );
  } catch (error) {
    logError("Failed to parse API connection Vault secret", error);
    return new Map<string, string>();
  }
}

async function deleteVaultSecret(vaultId: string | null) {
  if (!vaultId) {
    return;
  }

  await getDb().execute(sql`delete from vault.secrets where id = ${vaultId}::uuid`);
}

function mergeSecretHeaders(input: {
  nextSecretHeaders: Map<string, string>;
  existingSecretHeaders: Map<string, string>;
}) {
  const merged = new Map<string, string>();

  for (const [name, value] of input.nextSecretHeaders) {
    const nextValue = value.trim() ? value : input.existingSecretHeaders.get(name);

    if (nextValue) {
      merged.set(name, nextValue);
    }
  }

  return merged;
}

export async function listApiConnections() {
  const connectionRows = await getDb()
    .select()
    .from(apiConnections)
    .orderBy(desc(apiConnections.updatedAt));
  const ids = connectionRows.map((connection) => connection.id);
  const runRows =
    ids.length === 0
      ? []
      : await getDb()
          .select()
          .from(apiConnectionRuns)
          .where(inArray(apiConnectionRuns.connectionId, ids))
          .orderBy(desc(apiConnectionRuns.createdAt))
          .limit(50);

  return {
    connections: connectionRows.map(toApiConnection),
    runs: runRows.map(toApiConnectionRun),
  };
}

export async function createApiConnection(input: {
  actorOwnerId: string;
  connection: ApiConnectionInput;
}) {
  const normalized = normalizeConnectionInput(input.connection);

  if ([...normalized.secretHeaders.values()].some((value) => !value.trim())) {
    throw new ApiConnectionError("Secret header values are required.");
  }

  const [created] = await getDb()
    .insert(apiConnections)
    .values({
      name: normalized.name,
      description: normalized.description,
      method: normalized.method,
      url: normalized.url,
      requestHeaders: normalized.nonSecretHeaders,
      secretHeaderNames: [...normalized.secretHeaders.keys()],
      bodyTemplate: normalized.bodyTemplate,
      responseFormat: normalized.responseFormat,
      responseDataPath: normalized.responseDataPath,
      importMode: normalized.importMode,
      targetDatasetId: normalized.targetDatasetId,
      datasetName: normalized.datasetName,
      datasetClassification: normalized.datasetClassification,
      createdByOwnerId: input.actorOwnerId,
      updatedByOwnerId: input.actorOwnerId,
    })
    .returning();

  const secretVaultId = await createVaultSecret(created.id, normalized.secretHeaders);

  if (!secretVaultId) {
    return toApiConnection(created);
  }

  const [updated] = await getDb()
    .update(apiConnections)
    .set({
      secretVaultId,
      updatedAt: new Date(),
    })
    .where(eq(apiConnections.id, created.id))
    .returning();

  return toApiConnection(updated);
}

export async function updateApiConnection(input: {
  connectionId: string;
  actorOwnerId: string;
  connection: ApiConnectionInput;
}) {
  const [existing] = await getDb()
    .select()
    .from(apiConnections)
    .where(eq(apiConnections.id, input.connectionId))
    .limit(1);

  if (!existing) {
    return null;
  }

  const normalized = normalizeConnectionInput(input.connection);
  const existingSecrets = await readVaultSecret(existing.secretVaultId);
  const mergedSecrets = mergeSecretHeaders({
    nextSecretHeaders: normalized.secretHeaders,
    existingSecretHeaders: existingSecrets,
  });
  const secretVaultId =
    mergedSecrets.size === 0
      ? null
      : await updateVaultSecret({
          connectionId: existing.id,
          vaultId: existing.secretVaultId,
          secretHeaders: mergedSecrets,
        });

  if (mergedSecrets.size === 0) {
    await deleteVaultSecret(existing.secretVaultId);
  }

  const [updated] = await getDb()
    .update(apiConnections)
    .set({
      name: normalized.name,
      description: normalized.description,
      method: normalized.method,
      url: normalized.url,
      requestHeaders: normalized.nonSecretHeaders,
      secretHeaderNames: [...mergedSecrets.keys()],
      secretVaultId,
      bodyTemplate: normalized.bodyTemplate,
      responseFormat: normalized.responseFormat,
      responseDataPath: normalized.responseDataPath,
      importMode: normalized.importMode,
      targetDatasetId: normalized.targetDatasetId,
      datasetName: normalized.datasetName,
      datasetClassification: normalized.datasetClassification,
      updatedByOwnerId: input.actorOwnerId,
      updatedAt: new Date(),
    })
    .where(eq(apiConnections.id, existing.id))
    .returning();

  return toApiConnection(updated);
}

export async function deleteApiConnection(connectionId: string) {
  const [deleted] = await getDb()
    .delete(apiConnections)
    .where(eq(apiConnections.id, connectionId))
    .returning();

  if (!deleted) {
    return null;
  }

  await deleteVaultSecret(deleted.secretVaultId);
  return toApiConnection(deleted);
}

function isBlockedIpAddress(address: string) {
  const version = isIP(address);

  if (version === 4) {
    const octets = address.split(".").map((octet) => Number.parseInt(octet, 10));
    const [first = 0, second = 0] = octets;

    return (
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 0
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}

export async function assertSafeApiUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new ApiConnectionError("API connection URLs must use HTTPS.");
  }

  if (!url.hostname) {
    throw new ApiConnectionError("API connection URL is invalid.");
  }

  if (url.username || url.password) {
    throw new ApiConnectionError("API connection URLs cannot include credentials.");
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });

  if (
    addresses.length === 0 ||
    addresses.some((address) => isBlockedIpAddress(address.address))
  ) {
    throw new ApiConnectionError("API connection URL resolves to a blocked network.");
  }
}

function redactSecrets(value: string, secrets: Map<string, string>) {
  let redacted = value;

  for (const secret of secrets.values()) {
    if (!secret) {
      continue;
    }

    redacted = redacted.split(secret).join("[redacted]");
  }

  return redacted;
}

function previewResponse(value: string, secrets: Map<string, string>) {
  return redactSecrets(value.slice(0, MAX_PREVIEW_LENGTH), secrets);
}

async function readLimitedResponse(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_RESPONSE_BYTES) {
      throw new ApiConnectionError("API response is too large.", 502);
    }

    chunks.push(Buffer.from(value));
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function fetchWithSafeRedirects(input: {
  url: string;
  init: RequestInit;
  redirects?: number;
}): Promise<Response> {
  await assertSafeApiUrl(input.url);
  const response = await fetch(input.url, {
    ...input.init,
    redirect: "manual",
  });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.has("location")
  ) {
    const redirectCount = input.redirects ?? 0;

    if (redirectCount >= MAX_REDIRECTS) {
      throw new ApiConnectionError("API request redirected too many times.", 502);
    }

    const nextUrl = new URL(response.headers.get("location")!, input.url).toString();
    return fetchWithSafeRedirects({
      url: nextUrl,
      init: input.init,
      redirects: redirectCount + 1,
    });
  }

  return response;
}

function getJsonPathValue(value: unknown, path: string) {
  const trimmedPath = path.trim();

  if (!trimmedPath) {
    return value;
  }

  return trimmedPath.split(".").reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, value);
}

function objectToRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      entryValue === null || entryValue === undefined
        ? ""
        : typeof entryValue === "object"
          ? JSON.stringify(entryValue)
          : String(entryValue),
    ]),
  );
}

function rowsToColumns(rows: Record<string, string>[]) {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      labels.push(key);
    }
  }

  return normalizeHeaders(labels.length > 0 ? labels : ["value"]);
}

function alignRowsToColumns(input: {
  rows: Record<string, string>[];
  columns: CsvColumn[];
}) {
  return input.rows.map((row) =>
    Object.fromEntries(input.columns.map((column) => [column.key, row[column.label] ?? ""])),
  );
}

export function parseApiResponseRows(input: {
  body: string;
  responseFormat: ApiConnectionResponseFormat;
  responseDataPath: string;
}) {
  if (input.responseFormat === "csv") {
    const parsed = Papa.parse<Record<string, string>>(input.body, {
      header: true,
      skipEmptyLines: "greedy",
    });

    if (parsed.errors.length > 0) {
      throw new ApiConnectionError("CSV API response could not be parsed.", 502);
    }

    const rawRows = parsed.data.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value == null ? "" : String(value)]),
      ),
    );
    const columns = rowsToColumns(rawRows);

    return {
      rows: alignRowsToColumns({ rows: rawRows, columns }),
      columns,
    };
  }

  let json: unknown;

  try {
    json = JSON.parse(input.body);
  } catch {
    throw new ApiConnectionError("JSON API response could not be parsed.", 502);
  }

  const selected = getJsonPathValue(json, input.responseDataPath);
  const items = Array.isArray(selected) ? selected : [selected];

  if (items.some((item) => item === undefined)) {
    throw new ApiConnectionError("Configured JSON response path was not found.", 502);
  }

  const rawRows = items.map((item) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? objectToRecord(item as Record<string, unknown>)
      : { value: item == null ? "" : String(item) },
  );
  const columns = rowsToColumns(rawRows);

  return {
    rows: alignRowsToColumns({ rows: rawRows, columns }),
    columns,
  };
}

function escapeCsvCell(value: string) {
  return /[",\r\n]/u.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function serializeRowsToCsv(input: {
  rows: Record<string, string>[];
  columns: CsvColumn[];
}) {
  const header = input.columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = input.rows
    .map((row) =>
      input.columns.map((column) => escapeCsvCell(row[column.key] ?? "")).join(","),
    )
    .join("\n");

  return body ? `${header}\n${body}\n` : `${header}\n`;
}

async function uploadImportSnapshot(input: {
  fileName: string;
  csv: string;
}) {
  const path = createDatasetStoragePath(input.fileName);
  const supabase = createSupabaseAdminClient();
  const result = await supabase.storage
    .from(getDatasetStorageBucket())
    .upload(path, new Blob([input.csv], { type: "text/csv;charset=utf-8" }), {
      contentType: "text/csv;charset=utf-8",
      upsert: false,
    });

  if (result.error) {
    throw result.error;
  }

  return path;
}

async function persistImportedRows(input: {
  identity: CurrentIdentity;
  connection: ApiConnectionRecord;
  rows: Record<string, string>[];
  columns: CsvColumn[];
}) {
  const csv = serializeRowsToCsv({
    rows: input.rows,
    columns: input.columns,
  });
  const blobPath = await uploadImportSnapshot({
    fileName: input.connection.datasetName,
    csv,
  });
  const sizeBytes = Buffer.byteLength(csv);
  const dataset =
    input.connection.importMode === "replace" && input.connection.targetDatasetId
      ? (
          await replaceDatasetContents({
            datasetId: input.connection.targetDatasetId,
            actorOwnerId: input.identity.ownerId,
            actorEmail: input.identity.email,
            blobPath,
            sizeBytes,
            columns: input.columns,
            classification: input.connection.datasetClassification,
          })
        )?.dataset ?? null
      : await createDataset({
          ownerId: input.identity.ownerId,
          actorEmail: input.identity.email,
          fileName: input.connection.datasetName,
          blobPath,
          sizeBytes,
          columns: input.columns,
          classification: input.connection.datasetClassification,
        });

  if (!dataset) {
    throw new ApiConnectionError("Import target dataset was not found.", 404);
  }

  const chunks = chunkRows(input.rows);

  if (chunks.length === 0) {
    return insertDatasetRowBatch({
      datasetId: dataset.id,
      startIndex: 0,
      rows: [],
      isFinalBatch: true,
      totalRows: 0,
    });
  }

  let latestDataset: DatasetSummary | null = dataset;
  let startIndex = 0;
  for (const [index, rows] of chunks.entries()) {
    latestDataset = await insertDatasetRowBatch({
      datasetId: dataset.id,
      startIndex,
      rows,
      isFinalBatch: index === chunks.length - 1,
      totalRows: input.rows.length,
    });
    startIndex += rows.length;
  }

  return latestDataset;
}

async function insertRun(input: {
  connectionId: string;
  identity: CurrentIdentity;
  mode: ApiConnectionRunMode;
  status: ApiConnectionRunStatus;
  httpStatus: number | null;
  durationMs: number;
  rowCount: number | null;
  datasetId: string | null;
  errorMessage: string | null;
  responsePreview: string;
}) {
  const [run] = await getDb()
    .insert(apiConnectionRuns)
    .values({
      connectionId: input.connectionId,
      actorOwnerId: input.identity.ownerId,
      actorEmail: input.identity.email,
      mode: input.mode,
      status: input.status,
      httpStatus: input.httpStatus,
      durationMs: input.durationMs,
      rowCount: input.rowCount,
      datasetId: input.datasetId,
      errorMessage: input.errorMessage,
      responsePreview: input.responsePreview,
    })
    .returning();

  return toApiConnectionRun(run);
}

export async function runApiConnection(input: {
  connectionId: string;
  identity: CurrentIdentity;
  importEnabled: boolean;
}) {
  const [connection] = await getDb()
    .select()
    .from(apiConnections)
    .where(eq(apiConnections.id, input.connectionId))
    .limit(1);

  if (!connection) {
    return null;
  }

  const secrets = await readVaultSecret(connection.secretVaultId);
  const headers = new Headers();

  for (const header of connection.requestHeaders) {
    headers.set(header.name, header.value);
  }

  for (const [name, value] of secrets) {
    headers.set(name, value);
  }

  const startedAt = Date.now();
  let httpStatus: number | null = null;
  let responsePreview = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetchWithSafeRedirects({
        url: connection.url,
        init: {
          method: connection.method,
          headers,
          body:
            connection.method === "GET" ? undefined : connection.bodyTemplate || undefined,
          signal: controller.signal,
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    httpStatus = response.status;
    const body = await readLimitedResponse(response);
    responsePreview = previewResponse(body, secrets);

    if (!response.ok) {
      throw new ApiConnectionError(`API request failed with HTTP ${response.status}.`, 502);
    }

    let datasetId: string | null = null;
    let rowCount: number | null = null;

    if (input.importEnabled) {
      const parsed = parseApiResponseRows({
        body,
        responseFormat: connection.responseFormat,
        responseDataPath: connection.responseDataPath,
      });
      const dataset = await persistImportedRows({
        identity: input.identity,
        connection,
        rows: parsed.rows,
        columns: parsed.columns,
      });

      datasetId = dataset?.id ?? null;
      rowCount = parsed.rows.length;
    }

    const run = await insertRun({
      connectionId: connection.id,
      identity: input.identity,
      mode: input.importEnabled ? "import" : "test",
      status: "success",
      httpStatus,
      durationMs: Date.now() - startedAt,
      rowCount,
      datasetId,
      errorMessage: null,
      responsePreview,
    });

    await getDb()
      .update(apiConnections)
      .set({ updatedAt: new Date(), updatedByOwnerId: input.identity.ownerId })
      .where(eq(apiConnections.id, connection.id));

    const [updatedConnection] = await getDb()
      .select()
      .from(apiConnections)
      .where(eq(apiConnections.id, connection.id))
      .limit(1);

    return {
      connection: toApiConnection(updatedConnection),
      run,
    };
  } catch (error) {
    const message =
      error instanceof ApiConnectionError
        ? error.message
        : error instanceof Error && error.name === "AbortError"
          ? "API request timed out."
          : "API connection run failed.";

    if (!(error instanceof ApiConnectionError)) {
      logError("Failed to run API connection", error);
    }

    const run = await insertRun({
      connectionId: connection.id,
      identity: input.identity,
      mode: input.importEnabled ? "import" : "test",
      status: "failed",
      httpStatus,
      durationMs: Date.now() - startedAt,
      rowCount: null,
      datasetId: null,
      errorMessage: redactSecrets(message, secrets),
      responsePreview,
    });

    return {
      connection: toApiConnection(connection),
      run,
    };
  }
}

export async function listApiConnectionRuns(connectionId: string) {
  const rows = await getDb()
    .select()
    .from(apiConnectionRuns)
    .where(and(eq(apiConnectionRuns.connectionId, connectionId)))
    .orderBy(desc(apiConnectionRuns.createdAt))
    .limit(50);

  return rows.map(toApiConnectionRun);
}
