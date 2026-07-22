import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  apiConnectionResources,
  apiConnectionRunLogs,
  apiConnectionRunOutputs,
  apiConnectionRuns,
  apiConnections,
} from "@/db/schema";
import {
  checksumApiConnectionArtifact,
  parseApiConnectionRowsArtifact,
  serializeApiConnectionRawResponseArtifact,
  serializeApiConnectionRowsArtifact,
  serializeApiConnectionRowsToCsv,
} from "@/lib/api-connection-output";
import type { CurrentIdentity } from "@/lib/auth";
import { chunkRows, sanitizeFileName } from "@/lib/csv";
import {
  createDataset,
  insertDatasetRowBatch,
  replaceDatasetContents,
} from "@/lib/datasets";
import {
  API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE,
  getApiConnectionRunArtifactReadBuckets,
  getApiConnectionRunArtifactStorageBucket,
  createApiConnectionRunOutputStoragePath,
  createDatasetStoragePath,
  getDatasetStorageBucket,
} from "@/lib/dataset-storage";
import { logError } from "@/lib/error-logging";
import {
  GOOGLE_SHEETS_PROVIDER,
  GOOGLE_SHEETS_HEADER_PREVIEW_ROW_LIMIT,
  GoogleSheetsError,
  confirmGoogleSheetsHeaderSelection,
  createGoogleSheetsHeaderPreview,
  fetchGoogleSheetsSpreadsheetMetadata,
  fetchGoogleSheetsTabValues,
  getGoogleSheetsServiceAccountAccessToken,
  getGoogleSheetsServiceAccountEmail,
  parseGoogleSheetUrl,
} from "@/lib/google-sheets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ApiConnection,
  ApiConnectionHeader,
  ApiConnectionImportMode,
  ApiConnectionProviderConfig,
  ApiConnectionResource,
  ApiConnectionResponseFormat,
  ApiConnectionRun,
  ApiConnectionRunLog,
  ApiConnectionRunLogLevel,
  ApiConnectionRunOutput,
  ApiConnectionRunMode,
  ApiConnectionRunStatus,
  CsvColumn,
  DatasetClassification,
  DatasetSummary,
  GoogleSheetsConnectionProviderConfig,
  GoogleSheetsConnectionPreview,
  GoogleSheetsGridRange,
  GoogleSheetsHeaderPreview,
  GoogleSheetsHeaderSelectionInput,
} from "@/lib/api-types";

import {
  ApiConnectionError,
  HTTP_API_PROVIDER_CONFIG,
  JOSHUA_PROJECT_API_KEY_NAME,
  createApiConnectionRunRequest,
  normalizeApiConnectionProviderConfig,
  previewResponse,
  redactSecrets,
  serializeRowsToCsv,
} from "./core";
import { resolveConnectionProvider } from "./provider";
import {
  createVaultSecret,
  deleteVaultSecret,
  readVaultSecret,
  updateVaultSecret,
} from "./vault";

export {
  ApiConnectionError,
  assertSafeApiUrl,
  createApiConnectionRunRequest,
  parseApiResponseRows,
} from "./core";
export type { ApiConnectionRunRequestInput, ParsedApiRows } from "./core";
export {
  fetchArcgisFeaturePages,
  parseArcgisFeatureRows,
} from "./providers/arcgis";
export type {
  ApiConnectionRecord as ApiConnectionRow,
  ConnectionProvider,
} from "./provider";

export function getInitialDatasetWorkspaceVisibility(
  providerConfig: ApiConnectionProviderConfig,
) {
  return providerConfig.provider === GOOGLE_SHEETS_PROVIDER
    ? (providerConfig.isWorkspaceVisible ?? true)
    : true;
}

type ApiConnectionRecord = typeof apiConnections.$inferSelect;
type ApiConnectionRunRecord = typeof apiConnectionRuns.$inferSelect;
type ApiConnectionRunLogRecord = typeof apiConnectionRunLogs.$inferSelect;
type ApiConnectionRunOutputRecord = typeof apiConnectionRunOutputs.$inferSelect;
type ApiConnectionResourceRecord = typeof apiConnectionResources.$inferSelect;
type ExtractedApiConnectionResource = {
  connectionId: string;
  runId: string;
  resourceUrl: string;
  normalizedUrl: string;
  webText: string;
  sourceRowIndex: number;
  sourceResourceIndex: number;
};

type CodeManagedApiConnectionDefinition = {
  id: string;
  name: string;
  description: string;
  method: ApiConnection["method"];
  url: string;
  requestHeaders: ApiConnectionHeader[];
  secretHeaderNames: string[];
  bodyTemplate: string;
  responseFormat: ApiConnectionResponseFormat;
  responseDataPath: string;
  importMode: ApiConnectionImportMode;
  targetDatasetId: string | null;
  datasetName: string;
  datasetClassification: DatasetClassification;
};

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

const CODE_MANAGED_CONNECTION_TIMESTAMP = "2026-04-30T00:00:00.000Z";

export const IMB_API_CONNECTION_ID = "6f9f6ef2-1188-4f71-9c24-ef01debf7a01";

const CODE_MANAGED_API_CONNECTIONS: CodeManagedApiConnectionDefinition[] = [
  {
    id: IMB_API_CONNECTION_ID,
    name: "IMB (People Groups)",
    description: "IMB public ArcGIS people groups layer.",
    method: "GET",
    url: "https://services1.arcgis.com/mICk7VdFTP86wcbI/arcgis/rest/services/pIMBpeoplePublic/FeatureServer/0/query",
    requestHeaders: [],
    secretHeaderNames: [],
    bodyTemplate: "",
    responseFormat: "json",
    responseDataPath: "features",
    importMode: "create",
    targetDatasetId: null,
    datasetName: "imb-people-groups.csv",
    datasetClassification: "PGIC",
  },
  {
    id: "6f9f6ef2-1188-4f71-9c24-ef01debf7a02",
    name: "Etnopedia",
    description: "Etnopedia MediaWiki people-group export.",
    method: "GET",
    url: "https://en.etnopedia.org/api.php",
    requestHeaders: [],
    secretHeaderNames: [],
    bodyTemplate: "",
    responseFormat: "json",
    responseDataPath: "",
    importMode: "create",
    targetDatasetId: null,
    datasetName: "etnopedia-people.csv",
    datasetClassification: "PGIC",
  },
  {
    id: "6f9f6ef2-1188-4f71-9c24-ef01debf7a03",
    name: "Joshua Project (PGIC)",
    description:
      "Joshua Project people groups with profile text and resources. Requires the api_key secret.",
    method: "GET",
    url: "https://api.joshuaproject.net/v1/people_groups.json?include_profile_text=Y&include_resources=Y&page=1&limit=100000",
    requestHeaders: [],
    secretHeaderNames: [JOSHUA_PROJECT_API_KEY_NAME],
    bodyTemplate: "",
    responseFormat: "json",
    responseDataPath: "",
    importMode: "create",
    targetDatasetId: null,
    datasetName: "joshua-project-pgic.csv",
    datasetClassification: "PGIC",
  },
];

const codeManagedApiConnectionById = new Map(
  CODE_MANAGED_API_CONNECTIONS.map((connection) => [connection.id, connection]),
);

function toApiConnectionFromCodeManagedDefinition(
  definition: CodeManagedApiConnectionDefinition,
): ApiConnection {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    method: definition.method,
    url: definition.url,
    headers: [
      ...definition.requestHeaders,
      ...definition.secretHeaderNames.map((name) => ({
        name,
        value: "",
        isSecret: true,
      })),
    ],
    bodyTemplate: definition.bodyTemplate,
    responseFormat: definition.responseFormat,
    responseDataPath: definition.responseDataPath,
    importMode: definition.importMode,
    targetDatasetId: definition.targetDatasetId,
    datasetName: definition.datasetName,
    datasetClassification: definition.datasetClassification,
    provider: "http_api",
    providerConfig: HTTP_API_PROVIDER_CONFIG,
    createdAt: CODE_MANAGED_CONNECTION_TIMESTAMP,
    updatedAt: CODE_MANAGED_CONNECTION_TIMESTAMP,
  };
}

export function listCodeManagedApiConnections() {
  return CODE_MANAGED_API_CONNECTIONS.map(toApiConnectionFromCodeManagedDefinition);
}

function getCodeManagedApiConnectionDefinition(connectionId: string) {
  return codeManagedApiConnectionById.get(connectionId) ?? null;
}

function mergeCodeManagedApiConnections(connectionRows: ApiConnectionRecord[]) {
  const materializedById = new Map(
    connectionRows.map((connection) => [connection.id, connection]),
  );
  const codeManagedConnections = CODE_MANAGED_API_CONNECTIONS.map(
    (definition) => {
      const materialized = materializedById.get(definition.id);

      return materialized
        ? toApiConnection(materialized)
        : toApiConnectionFromCodeManagedDefinition(definition);
    },
  );
  const customConnections = connectionRows
    .filter((connection) => !codeManagedApiConnectionById.has(connection.id))
    .map(toApiConnection);

  return [
    ...codeManagedConnections,
    ...customConnections,
  ];
}

async function materializeCodeManagedApiConnection(input: {
  definition: CodeManagedApiConnectionDefinition;
  actorOwnerId: string;
}) {
  const [connection] = await getDb()
    .insert(apiConnections)
    .values({
      id: input.definition.id,
      name: input.definition.name,
      description: input.definition.description,
      method: input.definition.method,
      url: input.definition.url,
      requestHeaders: input.definition.requestHeaders,
      secretHeaderNames: input.definition.secretHeaderNames,
      bodyTemplate: input.definition.bodyTemplate,
      responseFormat: input.definition.responseFormat,
      responseDataPath: input.definition.responseDataPath,
      importMode: input.definition.importMode,
      targetDatasetId: input.definition.targetDatasetId,
      datasetName: input.definition.datasetName,
      datasetClassification: input.definition.datasetClassification,
      provider: "http_api",
      providerConfig: HTTP_API_PROVIDER_CONFIG,
      createdByOwnerId: input.actorOwnerId,
      updatedByOwnerId: input.actorOwnerId,
    })
    .onConflictDoUpdate({
      target: apiConnections.id,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        method: sql`excluded.method`,
        url: sql`excluded.url`,
        requestHeaders: sql`excluded.request_headers`,
        secretHeaderNames: sql`excluded.secret_header_names`,
        bodyTemplate: sql`excluded.body_template`,
        responseFormat: sql`excluded.response_format`,
        responseDataPath: sql`excluded.response_data_path`,
        importMode: sql`excluded.import_mode`,
        targetDatasetId: sql`excluded.target_dataset_id`,
        datasetName: sql`excluded.dataset_name`,
        datasetClassification: sql`excluded.dataset_classification`,
        provider: sql`excluded.provider`,
        providerConfig: sql`excluded.provider_config`,
        updatedByOwnerId: input.actorOwnerId,
        updatedAt: new Date(),
      },
    })
    .returning();

  return connection;
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
    provider: row.provider ?? "http_api",
    providerConfig: normalizeApiConnectionProviderConfig(
      row.providerConfig,
      row.provider,
    ),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    archivedByOwnerId: row.archivedByOwnerId,
    archiveReason: row.archiveReason,
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
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    logs: [],
    output: null,
  };
}

function toApiConnectionRunLog(
  row: ApiConnectionRunLogRecord,
): ApiConnectionRunLog {
  return {
    id: row.id,
    runId: row.runId,
    connectionId: row.connectionId,
    level: row.level,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

function toApiConnectionRunOutput(
  row: ApiConnectionRunOutputRecord,
): ApiConnectionRunOutput {
  return {
    id: row.id,
    runId: row.runId,
    connectionId: row.connectionId,
    rowCount: row.rowCount,
    columns: row.columns,
    rowsStoragePath: row.rowsStoragePath,
    rawStoragePath: row.rawStoragePath,
    rowsSizeBytes: row.rowsSizeBytes,
    rawSizeBytes: row.rawSizeBytes,
    rowsChecksum: row.rowsChecksum,
    rawChecksum: row.rawChecksum,
    createdAt: row.createdAt.toISOString(),
  };
}

function toApiConnectionResource(
  row: ApiConnectionResourceRecord,
): ApiConnectionResource {
  return {
    id: row.id,
    connectionId: row.connectionId,
    runId: row.runId,
    resourceUrl: row.resourceUrl,
    normalizedUrl: row.normalizedUrl,
    webText: row.webText,
    sourceRowIndex: row.sourceRowIndex,
    sourceResourceIndex: row.sourceResourceIndex,
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

function sanitizeGoogleSheetDatasetName(input: {
  spreadsheetTitle: string;
  sheetTitle: string;
}) {
  return sanitizeFileName(`${input.spreadsheetTitle}-${input.sheetTitle}.csv`);
}

export function normalizeGoogleSheetsDatasetSettings(input: {
  selectedSheetIds: number[];
  datasetSettings?: Array<{ sheetId: number; datasetName: string }>;
}) {
  if (!input.datasetSettings) return null;

  const settings = new Map(
    input.datasetSettings.map((setting) => [
      setting.sheetId,
      sanitizeFileName(setting.datasetName),
    ]),
  );
  const selectedIds = new Set(input.selectedSheetIds);
  const normalizedNames = [...settings.values()].map((name) =>
    name.toLocaleLowerCase(),
  );
  if (
    settings.size !== selectedIds.size ||
    [...selectedIds].some((sheetId) => !settings.has(sheetId)) ||
    [...settings.keys()].some((sheetId) => !selectedIds.has(sheetId)) ||
    new Set(normalizedNames).size !== normalizedNames.length
  ) {
    throw new ApiConnectionError(
      "Choose one unique dataset name for every selected Google Sheet tab.",
      400,
    );
  }
  return settings;
}

function shareWithServiceAccountMessage(serviceAccountEmail: string) {
  return `Share this Sheet with ${serviceAccountEmail} as Viewer, then check again.`;
}

function toGoogleSheetsConnectionPreview(input: {
  spreadsheetUrl: string;
  metadata: Awaited<ReturnType<typeof fetchGoogleSheetsSpreadsheetMetadata>>;
}): GoogleSheetsConnectionPreview {
  return {
    spreadsheetId: input.metadata.spreadsheetId,
    spreadsheetUrl: input.spreadsheetUrl,
    spreadsheetTitle: input.metadata.spreadsheetTitle,
    sheets: input.metadata.sheets,
  };
}

async function loadGoogleSheetsServiceAccountPreview(spreadsheetUrl: string) {
  const parsedUrl = parseGoogleSheetUrl(spreadsheetUrl);
  const serviceAccountEmail = getGoogleSheetsServiceAccountEmail();

  try {
    const accessToken = await getGoogleSheetsServiceAccountAccessToken();
    const metadata = await fetchGoogleSheetsSpreadsheetMetadata({
      spreadsheetId: parsedUrl.spreadsheetId,
      accessToken,
    });

    return {
      parsedUrl,
      accessToken,
      serviceAccountEmail,
      metadata,
      preview: toGoogleSheetsConnectionPreview({
        spreadsheetUrl: parsedUrl.spreadsheetUrl,
        metadata,
      }),
    };
  } catch (error) {
    if (error instanceof GoogleSheetsError && error.status === 403) {
      throw new ApiConnectionError(
        shareWithServiceAccountMessage(serviceAccountEmail),
        403,
      );
    }

    throw error;
  }
}

export function resolveGoogleSheetsConnectionTab(input: {
  providerConfig: GoogleSheetsConnectionProviderConfig;
  metadata: Awaited<ReturnType<typeof fetchGoogleSheetsSpreadsheetMetadata>>;
}) {
  const selectedSheet = input.metadata.sheets.find(
    (sheet) => sheet.sheetId === input.providerConfig.sheetId,
  );

  if (!selectedSheet) {
    throw new ApiConnectionError(
      "Google Sheet tab is not readable by the service account.",
      404,
    );
  }

  return {
    selectedSheet,
    spreadsheetTitle:
      input.metadata.spreadsheetTitle || input.providerConfig.spreadsheetTitle,
  };
}

async function synchronizeGoogleSheetsConnectionTab(
  connection: ApiConnectionRecord,
) {
  const providerConfig = normalizeApiConnectionProviderConfig(
    connection.providerConfig,
    connection.provider,
  );

  if (providerConfig.provider !== GOOGLE_SHEETS_PROVIDER) {
    throw new ApiConnectionError("Google Sheets connection metadata is invalid.", 400);
  }

  const accessToken = await getGoogleSheetsServiceAccountAccessToken();
  const metadata = await fetchGoogleSheetsSpreadsheetMetadata({
    spreadsheetId: providerConfig.spreadsheetId,
    accessToken,
  });
  const { selectedSheet, spreadsheetTitle } = resolveGoogleSheetsConnectionTab({
    providerConfig,
    metadata,
  });
  if (
    selectedSheet.title === providerConfig.sheetTitle &&
    spreadsheetTitle === providerConfig.spreadsheetTitle
  ) {
    return { connection, metadata, selectedSheet };
  }

  const nextProviderConfig = {
    ...providerConfig,
    spreadsheetTitle,
    sheetTitle: selectedSheet.title,
  } satisfies GoogleSheetsConnectionProviderConfig;
  const [updated] = await getDb()
    .update(apiConnections)
    .set({
      name: providerConfig.usesCustomDatasetName
        ? connection.name
        : `${spreadsheetTitle} - ${selectedSheet.title}`,
      providerConfig: nextProviderConfig,
      updatedAt: new Date(),
    })
    .where(eq(apiConnections.id, connection.id))
    .returning();

  return { connection: updated, metadata, selectedSheet };
}

export async function previewGoogleSheetsConnection(input: {
  identity: CurrentIdentity;
  spreadsheetUrl: string;
}) {
  void input.identity;

  const { preview, serviceAccountEmail } =
    await loadGoogleSheetsServiceAccountPreview(input.spreadsheetUrl);

  return {
    preview,
    serviceAccountEmail,
  };
}

async function getGoogleSheetsHeaderPreview(input: {
  spreadsheetUrl: string;
  sheetId: number;
  selection?: GoogleSheetsHeaderSelectionInput;
}) {
  const { metadata, accessToken } = await loadGoogleSheetsServiceAccountPreview(
    input.spreadsheetUrl,
  );
  const selectedSheet = metadata.sheets.find(
    (sheet) => sheet.sheetId === input.sheetId,
  );
  if (!selectedSheet) {
    throw new ApiConnectionError(
      "Google Sheet tab is not readable by the service account.",
      404,
    );
  }
  const values = await fetchGoogleSheetsTabValues({
    spreadsheetId: metadata.spreadsheetId,
    sheetTitle: selectedSheet.title,
    accessToken,
    rowLimit: GOOGLE_SHEETS_HEADER_PREVIEW_ROW_LIMIT,
  });
  const selection = input.selection
    ? {
        mode: input.selection.mode,
        startRow: input.selection.startRow,
        endRow: input.selection.endRow,
      }
    : undefined;

  return {
    metadata,
    selectedSheet,
    values,
    preview: createGoogleSheetsHeaderPreview({
      values,
      sheetId: selectedSheet.sheetId,
      sheetTitle: selectedSheet.title,
      merges: selectedSheet.merges ?? [],
      selection,
    }),
  };
}

export async function previewGoogleSheetsConnectionHeader(input: {
  identity: CurrentIdentity;
  spreadsheetUrl: string;
  sheetId: number;
  selection?: GoogleSheetsHeaderSelectionInput;
}): Promise<GoogleSheetsHeaderPreview> {
  void input.identity;
  return (await getGoogleSheetsHeaderPreview(input)).preview;
}

function confirmGoogleSheetsHeaderFromPreview(input: {
  values: unknown[][];
  sheetId: number;
  sheetTitle: string;
  merges: GoogleSheetsGridRange[];
  selection: GoogleSheetsHeaderSelectionInput;
}) {
  return confirmGoogleSheetsHeaderSelection({
    values: input.values,
    sheetId: input.sheetId,
    sheetTitle: input.sheetTitle,
    merges: input.merges,
    selection: input.selection,
  });
}

export async function createGoogleSheetsConnections(input: {
  identity: CurrentIdentity;
  spreadsheetUrl: string;
  selectedSheetIds: number[];
  headerSelections: GoogleSheetsHeaderSelectionInput[];
  datasetSettings?: Array<{
    sheetId: number;
    datasetName: string;
  }>;
  datasetClassification: DatasetClassification;
  isWorkspaceVisible: boolean;
}) {
  const { parsedUrl, metadata, accessToken } = await loadGoogleSheetsServiceAccountPreview(
    input.spreadsheetUrl,
  );
  const selectedIds = new Set(input.selectedSheetIds);
  const selectedSheets = metadata.sheets.filter((sheet) =>
    selectedIds.has(sheet.sheetId),
  );

  if (selectedSheets.length === 0 || selectedSheets.length !== selectedIds.size) {
    throw new ApiConnectionError("Choose at least one valid Google Sheet tab.", 400);
  }
  const selectionBySheetId = new Map(
    input.headerSelections.map((selection) => [selection.sheetId, selection]),
  );
  if (
    selectionBySheetId.size !== selectedSheets.length ||
    selectedSheets.some((sheet) => !selectionBySheetId.has(sheet.sheetId))
  ) {
    throw new ApiConnectionError(
      "Review the header row for every selected Google Sheet tab.",
      400,
    );
  }
  const datasetSettingBySheetId = normalizeGoogleSheetsDatasetSettings({
    selectedSheetIds: input.selectedSheetIds,
    datasetSettings: input.datasetSettings,
  });
  const confirmedHeaderBySheetId = new Map(
    await Promise.all(
      selectedSheets.map(async (sheet) => {
        const values = await fetchGoogleSheetsTabValues({
          spreadsheetId: metadata.spreadsheetId,
          sheetTitle: sheet.title,
          accessToken,
          rowLimit: GOOGLE_SHEETS_HEADER_PREVIEW_ROW_LIMIT,
        });
        const confirmed = confirmGoogleSheetsHeaderFromPreview({
          values,
          sheetId: sheet.sheetId,
          sheetTitle: sheet.title,
          merges: sheet.merges ?? [],
          selection: selectionBySheetId.get(sheet.sheetId)!,
        });
        return [sheet.sheetId, confirmed.configuration] as const;
      }),
    ),
  );

  const spreadsheetTitle = metadata.spreadsheetTitle || "Google Sheet";
  try {
    const created = await getDb().transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(apiConnections)
        .where(
          and(
            eq(apiConnections.provider, GOOGLE_SHEETS_PROVIDER),
            sql`${apiConnections.providerConfig} ->> 'spreadsheetId' = ${metadata.spreadsheetId}`,
          ),
        )
        .orderBy(desc(apiConnections.updatedAt));
      const existingBySheetId = new Map<number, ApiConnectionRecord[]>();

      for (const existing of existingRows) {
        const config = normalizeApiConnectionProviderConfig(
          existing.providerConfig,
          existing.provider,
        );
        if (
          config.provider === GOOGLE_SHEETS_PROVIDER &&
          selectedIds.has(config.sheetId)
        ) {
          existingBySheetId.set(config.sheetId, [
            ...(existingBySheetId.get(config.sheetId) ?? []),
            existing,
          ]);
        }
      }

      const conflicts = selectedSheets.filter((sheet) =>
        (existingBySheetId.get(sheet.sheetId) ?? []).some(
          (connection) => connection.archivedAt === null,
        ),
      );

      if (conflicts.length > 0) {
        throw new ApiConnectionError(
          `Already connected: ${conflicts.map((sheet) => sheet.title).join(", ")}.`,
          409,
        );
      }

      const rows: ApiConnectionRecord[] = [];
      for (const sheet of selectedSheets) {
        const reviewedDatasetName = datasetSettingBySheetId?.get(sheet.sheetId);
        const providerConfig = {
            provider: GOOGLE_SHEETS_PROVIDER,
            spreadsheetId: metadata.spreadsheetId,
            spreadsheetUrl: parsedUrl.spreadsheetUrl,
            spreadsheetTitle,
            sheetId: sheet.sheetId,
            sheetTitle: sheet.title,
            rangeMode: "full_tab",
            isWorkspaceVisible: input.isWorkspaceVisible,
            usesCustomDatasetName: Boolean(reviewedDatasetName),
            headerSelection: confirmedHeaderBySheetId.get(sheet.sheetId)!,
          } satisfies GoogleSheetsConnectionProviderConfig;
        const archived = (existingBySheetId.get(sheet.sheetId) ?? []).find(
          (connection) => connection.archivedAt !== null,
        );
        const values = {
            name: reviewedDatasetName ?? `${spreadsheetTitle} - ${sheet.title}`,
            description: "Private Google Sheets tab.",
            method: "GET" as const,
            url: parsedUrl.spreadsheetUrl,
            requestHeaders: [],
            secretHeaderNames: [],
            secretVaultId: null,
            bodyTemplate: "",
            responseFormat: "csv" as const,
            responseDataPath: "",
            importMode: "create" as const,
            targetDatasetId: null,
            datasetName:
              reviewedDatasetName ??
              sanitizeGoogleSheetDatasetName({
                spreadsheetTitle,
                sheetTitle: sheet.title,
              }),
            datasetClassification: input.datasetClassification,
            provider: GOOGLE_SHEETS_PROVIDER,
            providerConfig,
            updatedByOwnerId: input.identity.ownerId,
            archivedAt: null,
            archivedByOwnerId: null,
            archiveReason: null,
          };

        if (archived) {
          const [reactivated] = await tx
            .update(apiConnections)
            .set(values)
            .where(eq(apiConnections.id, archived.id))
            .returning();
          rows.push(reactivated);
        } else {
          const [inserted] = await tx
            .insert(apiConnections)
            .values({
              ...values,
              createdByOwnerId: input.identity.ownerId,
            })
            .returning();
          rows.push(inserted);
        }
      }

      return rows;
    });

    return created.map(toApiConnection);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ApiConnectionError(
        "One or more selected Google Sheet tabs are already connected.",
        409,
      );
    }

    throw error;
  }
}

export async function checkGoogleSheetsConnectionAccess(input: {
  identity: CurrentIdentity;
  connectionId: string;
}) {
  void input.identity;

  const [connection] = await getDb()
    .select()
    .from(apiConnections)
    .where(eq(apiConnections.id, input.connectionId))
    .limit(1);

  if (
    !connection ||
    connection.provider !== GOOGLE_SHEETS_PROVIDER ||
    connection.archivedAt
  ) {
    return null;
  }

  const providerConfig = normalizeApiConnectionProviderConfig(
    connection.providerConfig,
    connection.provider,
  );

  if (providerConfig.provider !== GOOGLE_SHEETS_PROVIDER) {
    throw new ApiConnectionError("Google Sheets connection metadata is invalid.", 400);
  }

  const serviceAccountEmail = getGoogleSheetsServiceAccountEmail();

  try {
    const synchronized = await synchronizeGoogleSheetsConnectionTab(connection);

    return {
      connection: toApiConnection(synchronized.connection),
      preview: toGoogleSheetsConnectionPreview({
        spreadsheetUrl: providerConfig.spreadsheetUrl,
        metadata: {
          ...synchronized.metadata,
          sheets: [synchronized.selectedSheet],
        },
      }),
      serviceAccountEmail,
    };
  } catch (error) {
    if (error instanceof GoogleSheetsError && error.status === 403) {
      throw new ApiConnectionError(
        shareWithServiceAccountMessage(serviceAccountEmail),
        403,
      );
    }

    throw error;
  }
}

async function getActiveGoogleSheetsConnection(connectionId: string) {
  const [connection] = await getDb()
    .select()
    .from(apiConnections)
    .where(eq(apiConnections.id, connectionId))
    .limit(1);
  if (
    !connection ||
    connection.provider !== GOOGLE_SHEETS_PROVIDER ||
    connection.archivedAt
  ) {
    return null;
  }
  const providerConfig = normalizeApiConnectionProviderConfig(
    connection.providerConfig,
    connection.provider,
  );
  if (providerConfig.provider !== GOOGLE_SHEETS_PROVIDER) {
    throw new ApiConnectionError("Google Sheets connection metadata is invalid.", 400);
  }
  return { connection, providerConfig };
}

export async function previewExistingGoogleSheetsConnectionHeader(input: {
  identity: CurrentIdentity;
  connectionId: string;
  selection?: GoogleSheetsHeaderSelectionInput;
}) {
  void input.identity;
  const active = await getActiveGoogleSheetsConnection(input.connectionId);
  if (!active) {
    return null;
  }
  const synchronized = await synchronizeGoogleSheetsConnectionTab(
    active.connection,
  );
  const providerConfig = normalizeApiConnectionProviderConfig(
    synchronized.connection.providerConfig,
    synchronized.connection.provider,
  );
  if (providerConfig.provider !== GOOGLE_SHEETS_PROVIDER) {
    throw new ApiConnectionError("Google Sheets connection metadata is invalid.", 400);
  }
  const headerPreview = await getGoogleSheetsHeaderPreview({
    spreadsheetUrl: providerConfig.spreadsheetUrl,
    sheetId: providerConfig.sheetId,
    selection: input.selection,
  });
  return headerPreview.preview;
}

export async function updateGoogleSheetsConnectionHeaderSelection(input: {
  identity: CurrentIdentity;
  connectionId: string;
  selection: GoogleSheetsHeaderSelectionInput;
}) {
  const active = await getActiveGoogleSheetsConnection(input.connectionId);
  if (!active) {
    return null;
  }
  const synchronized = await synchronizeGoogleSheetsConnectionTab(
    active.connection,
  );
  const providerConfig = normalizeApiConnectionProviderConfig(
    synchronized.connection.providerConfig,
    synchronized.connection.provider,
  );
  if (providerConfig.provider !== GOOGLE_SHEETS_PROVIDER) {
    throw new ApiConnectionError("Google Sheets connection metadata is invalid.", 400);
  }
  const headerPreview = await getGoogleSheetsHeaderPreview({
    spreadsheetUrl: providerConfig.spreadsheetUrl,
    sheetId: providerConfig.sheetId,
    selection: input.selection,
  });
  const confirmed = confirmGoogleSheetsHeaderFromPreview({
    values: headerPreview.values,
    sheetId: headerPreview.selectedSheet.sheetId,
    sheetTitle: headerPreview.selectedSheet.title,
    merges: headerPreview.selectedSheet.merges ?? [],
    selection: input.selection,
  });
  const nextProviderConfig = {
    ...providerConfig,
    headerSelection: confirmed.configuration,
  } satisfies GoogleSheetsConnectionProviderConfig;
  const [updated] = await getDb()
    .update(apiConnections)
    .set({
      providerConfig: nextProviderConfig,
      updatedByOwnerId: input.identity.ownerId,
      updatedAt: new Date(),
    })
    .where(eq(apiConnections.id, synchronized.connection.id))
    .returning();

  return {
    connection: toApiConnection(updated),
    preview: confirmed.preview,
  };
}

async function hydrateRunDetails(runRows: ApiConnectionRunRecord[]) {
  if (runRows.length === 0) {
    return [];
  }

  const runIds = runRows.map((run) => run.id);
  const [logRows, outputRows] = await Promise.all([
    getDb()
      .select()
      .from(apiConnectionRunLogs)
      .where(inArray(apiConnectionRunLogs.runId, runIds))
      .orderBy(asc(apiConnectionRunLogs.createdAt)),
    getDb()
      .select()
      .from(apiConnectionRunOutputs)
      .where(inArray(apiConnectionRunOutputs.runId, runIds)),
  ]);
  const logsByRunId = new Map<string, ApiConnectionRunLog[]>();
  const outputByRunId = new Map<string, ApiConnectionRunOutput>();

  for (const log of logRows.map(toApiConnectionRunLog)) {
    logsByRunId.set(log.runId, [...(logsByRunId.get(log.runId) ?? []), log]);
  }

  for (const output of outputRows.map(toApiConnectionRunOutput)) {
    outputByRunId.set(output.runId, output);
  }

  return runRows.map((row) => ({
    ...toApiConnectionRun(row),
    logs: logsByRunId.get(row.id) ?? [],
    output: outputByRunId.get(row.id) ?? null,
  }));
}

export async function listApiConnections() {
  const connectionRows = await getDb()
    .select()
    .from(apiConnections)
    .where(isNull(apiConnections.archivedAt))
    .orderBy(desc(apiConnections.updatedAt));
  const ids = connectionRows.map((connection) => connection.id);
  const [runRows, resourceRows]: [
    ApiConnectionRunRecord[],
    ApiConnectionResourceRecord[],
  ] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          getDb()
            .select()
            .from(apiConnectionRuns)
            .where(inArray(apiConnectionRuns.connectionId, ids))
            .orderBy(desc(apiConnectionRuns.createdAt))
            .limit(50),
          getDb()
            .select()
            .from(apiConnectionResources)
            .where(inArray(apiConnectionResources.connectionId, ids))
            .orderBy(desc(apiConnectionResources.createdAt))
            .limit(500),
        ]);

  return {
    connections: mergeCodeManagedApiConnections(connectionRows),
    runs: await hydrateRunDetails(runRows),
    resources: resourceRows.map(toApiConnectionResource),
  };
}

export async function getApiConnection(connectionId: string) {
  const [connection] = await getDb()
    .select()
    .from(apiConnections)
    .where(eq(apiConnections.id, connectionId))
    .limit(1);

  if (connection) {
    return toApiConnection(connection);
  }

  const codeManagedDefinition = getCodeManagedApiConnectionDefinition(connectionId);

  return codeManagedDefinition
    ? toApiConnectionFromCodeManagedDefinition(codeManagedDefinition)
    : null;
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
      provider: "http_api",
      providerConfig: HTTP_API_PROVIDER_CONFIG,
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
      provider: "http_api",
      providerConfig: HTTP_API_PROVIDER_CONFIG,
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

export async function disconnectGoogleSheetsConnection(input: {
  connectionId: string;
  identity: CurrentIdentity;
}) {
  const [connection] = await getDb()
    .select()
    .from(apiConnections)
    .where(eq(apiConnections.id, input.connectionId))
    .limit(1);

  if (!connection || connection.provider !== GOOGLE_SHEETS_PROVIDER) {
    return null;
  }

  if (connection.archivedAt) {
    return toApiConnection(connection);
  }

  const [archived] = await getDb()
    .update(apiConnections)
    .set({
      archivedAt: new Date(),
      archivedByOwnerId: input.identity.ownerId,
      archiveReason: "Disconnected by administrator.",
      updatedByOwnerId: input.identity.ownerId,
      updatedAt: new Date(),
    })
    .where(eq(apiConnections.id, connection.id))
    .returning();

  if (!archived) {
    return null;
  }

  return toApiConnection(archived);
}

function normalizeApiConnectionResourceUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";

    return {
      resourceUrl: trimmedValue,
      normalizedUrl: url.toString(),
    };
  } catch {
    return null;
  }
}

function mergeResourceText(current: string, next: string) {
  return current || next.trim();
}

export function extractApiConnectionResources(input: {
  connectionId: string;
  runId: string;
  rows: Record<string, string>[];
}): ExtractedApiConnectionResource[] {
  const resourcesByNormalizedUrl = new Map<string, ExtractedApiConnectionResource>();

  input.rows.forEach((row, rowIndex) => {
    for (const [key, value] of Object.entries(row)) {
      const match = /^resource_(\d+)_url$/i.exec(key);

      if (!match) {
        continue;
      }

      const normalized = normalizeApiConnectionResourceUrl(value);

      if (!normalized) {
        continue;
      }

      const sourceResourceIndex = Number.parseInt(match[1]!, 10);
      const resourcePrefix = `resource_${match[1]}`;
      const webText = row[`${resourcePrefix}_webtext`] ?? "";
      const existing = resourcesByNormalizedUrl.get(normalized.normalizedUrl);

      if (existing) {
        existing.webText = mergeResourceText(existing.webText, webText);
        continue;
      }

      resourcesByNormalizedUrl.set(normalized.normalizedUrl, {
        connectionId: input.connectionId,
        runId: input.runId,
        resourceUrl: normalized.resourceUrl,
        normalizedUrl: normalized.normalizedUrl,
        webText: webText.trim(),
        sourceRowIndex: rowIndex,
        sourceResourceIndex,
      });
    }
  });

  return [...resourcesByNormalizedUrl.values()];
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
  const providerConfig = normalizeApiConnectionProviderConfig(
    input.connection.providerConfig,
    input.connection.provider,
  );
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
          isWorkspaceVisible: getInitialDatasetWorkspaceVisibility(providerConfig),
        });

  if (!dataset) {
    throw new ApiConnectionError("Import target dataset was not found.", 404);
  }

  const chunks = chunkRows(input.rows);

  if (chunks.length === 0) {
    const latestDataset = await insertDatasetRowBatch({
      datasetId: dataset.id,
      startIndex: 0,
      rows: [],
      isFinalBatch: true,
      totalRows: 0,
    });

    if (!latestDataset) {
      throw new ApiConnectionError("Import target dataset was not found.", 404);
    }

    await bindGoogleSheetsConnectionTarget({
      connection: input.connection,
      datasetId: latestDataset.id,
      actorOwnerId: input.identity.ownerId,
    });

    return latestDataset;
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

  if (latestDataset) {
    await bindGoogleSheetsConnectionTarget({
      connection: input.connection,
      datasetId: latestDataset.id,
      actorOwnerId: input.identity.ownerId,
    });
  }

  return latestDataset;
}

async function bindGoogleSheetsConnectionTarget(input: {
  connection: ApiConnectionRecord;
  datasetId: string;
  actorOwnerId: string;
}) {
  if (
    input.connection.provider !== GOOGLE_SHEETS_PROVIDER ||
    input.connection.targetDatasetId
  ) {
    return;
  }

  await getDb()
    .update(apiConnections)
    .set({
      importMode: "replace",
      targetDatasetId: input.datasetId,
      updatedByOwnerId: input.actorOwnerId,
      updatedAt: new Date(),
    })
    .where(eq(apiConnections.id, input.connection.id));
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
  startedAt?: Date | null;
  completedAt?: Date | null;
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
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
    })
    .returning();

  return toApiConnectionRun(run);
}

async function insertRunLog(input: {
  runId: string;
  connectionId: string;
  level?: ApiConnectionRunLogLevel;
  message: string;
}) {
  const [log] = await getDb()
    .insert(apiConnectionRunLogs)
    .values({
      runId: input.runId,
      connectionId: input.connectionId,
      level: input.level ?? "info",
      message: input.message,
    })
    .returning();

  return toApiConnectionRunLog(log);
}

async function updateRun(input: {
  runId: string;
  status: ApiConnectionRunStatus;
  httpStatus?: number | null;
  durationMs?: number;
  rowCount?: number | null;
  datasetId?: string | null;
  errorMessage?: string | null;
  responsePreview?: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
}) {
  const [run] = await getDb()
    .update(apiConnectionRuns)
    .set({
      status: input.status,
      httpStatus: input.httpStatus,
      durationMs: input.durationMs,
      rowCount: input.rowCount,
      datasetId: input.datasetId,
      errorMessage: input.errorMessage,
      responsePreview: input.responsePreview,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    })
    .where(eq(apiConnectionRuns.id, input.runId))
    .returning();

  return run;
}

async function uploadRunArtifact(input: {
  runId: string;
  fileName: string;
  content: string;
}) {
  const path = createApiConnectionRunOutputStoragePath(input.runId, input.fileName);
  const supabase = createSupabaseAdminClient();
  const result = await supabase.storage
    .from(getApiConnectionRunArtifactStorageBucket())
    .upload(
      path,
      new Blob([input.content], { type: API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE }),
      {
        contentType: API_CONNECTION_RUN_ARTIFACT_CONTENT_TYPE,
        upsert: false,
      },
    );

  if (result.error) {
    throw result.error;
  }

  return path;
}

async function persistRunOutput(input: {
  run: ApiConnectionRunRecord;
  connection: ApiConnectionRecord;
  parsed: {
    rows: Record<string, string>[];
    columns: CsvColumn[];
  };
  redactedBody: string;
  httpStatus: number | null;
}) {
  const rowsArtifact = serializeApiConnectionRowsArtifact({
    rows: input.parsed.rows,
    columns: input.parsed.columns,
  });
  const rawArtifact = serializeApiConnectionRawResponseArtifact({
    runId: input.run.id,
    connectionId: input.connection.id,
    mode: input.run.mode,
    responseFormat: input.connection.responseFormat,
    responseDataPath: input.connection.responseDataPath,
    httpStatus: input.httpStatus,
    rowCount: input.parsed.rows.length,
    rawResponse: input.redactedBody,
  });
  const [rowsStoragePath, rawStoragePath] = await Promise.all([
    uploadRunArtifact({
      runId: input.run.id,
      fileName: "rows.json",
      content: rowsArtifact,
    }),
    uploadRunArtifact({
      runId: input.run.id,
      fileName: "raw-response.json",
      content: rawArtifact,
    }),
  ]);
  const [output] = await getDb()
    .insert(apiConnectionRunOutputs)
    .values({
      runId: input.run.id,
      connectionId: input.connection.id,
      rowCount: input.parsed.rows.length,
      columns: input.parsed.columns,
      rowsStoragePath,
      rawStoragePath,
      rowsSizeBytes: Buffer.byteLength(rowsArtifact),
      rawSizeBytes: Buffer.byteLength(rawArtifact),
      rowsChecksum: checksumApiConnectionArtifact(rowsArtifact),
      rawChecksum: checksumApiConnectionArtifact(rawArtifact),
    })
    .returning();

  return toApiConnectionRunOutput(output);
}

export async function publishApiConnectionResources(input: {
  connectionId: string;
  runId: string;
  rows: Record<string, string>[];
}) {
  const resources = extractApiConnectionResources({
    connectionId: input.connectionId,
    runId: input.runId,
    rows: input.rows,
  });

  if (resources.length === 0) {
    return 0;
  }

  await getDb()
    .insert(apiConnectionResources)
    .values(resources)
    .onConflictDoNothing({
      target: [
        apiConnectionResources.connectionId,
        apiConnectionResources.runId,
        apiConnectionResources.normalizedUrl,
      ],
    });

  return resources.length;
}

export async function startApiConnectionRun(input: {
  connectionId: string;
  identity: CurrentIdentity;
  importEnabled: boolean;
}) {
  let [connection] = await getDb()
    .select()
    .from(apiConnections)
    .where(
      and(
        eq(apiConnections.id, input.connectionId),
        isNull(apiConnections.archivedAt),
      ),
    )
    .limit(1);

  if (!connection) {
    const codeManagedDefinition = getCodeManagedApiConnectionDefinition(
      input.connectionId,
    );

    if (!codeManagedDefinition) {
      return null;
    }

    connection = await materializeCodeManagedApiConnection({
      definition: codeManagedDefinition,
      actorOwnerId: input.identity.ownerId,
    });
  }

  const run = await insertRun({
    connectionId: connection.id,
    identity: input.identity,
    mode: input.importEnabled ? "import" : "test",
    status: "queued",
    httpStatus: null,
    durationMs: 0,
    rowCount: null,
    datasetId: null,
    errorMessage: null,
    responsePreview: "",
  });

  await insertRunLog({
    runId: run.id,
    connectionId: connection.id,
    message: "Run queued.",
  });

  return {
    connection: toApiConnection(connection),
    run: (await getApiConnectionRunDetail({
      connectionId: connection.id,
      runId: run.id,
    }))!,
  };
}

function identityFromRun(run: ApiConnectionRunRecord): CurrentIdentity {
  return {
    ownerId: run.actorOwnerId,
    email: run.actorEmail,
    fullName: null,
    workspaceRole: "admin",
    isDatasetAdmin: true,
    mode: "supabase",
  };
}

export async function executeApiConnectionRun(input: { runId: string }) {
  const [run] = await getDb()
    .select()
    .from(apiConnectionRuns)
    .where(eq(apiConnectionRuns.id, input.runId))
    .limit(1);

  if (!run || run.status !== "queued") {
    return null;
  }

  const [connection] = await getDb()
    .select()
    .from(apiConnections)
    .where(eq(apiConnections.id, run.connectionId))
    .limit(1);

  if (!connection) {
    await updateRun({
      runId: run.id,
      status: "failed",
      durationMs: 0,
      errorMessage: "API connection not found.",
      completedAt: new Date(),
    });
    return null;
  }

  if (connection.archivedAt) {
    await updateRun({
      runId: run.id,
      status: "failed",
      durationMs: 0,
      errorMessage: "API connection was disconnected before execution.",
      completedAt: new Date(),
    });
    await insertRunLog({
      runId: run.id,
      connectionId: connection.id,
      level: "error",
      message: "API connection was disconnected before execution.",
    });
    return {
      connection: toApiConnection(connection),
      run: await getApiConnectionRunDetail({
        connectionId: connection.id,
        runId: run.id,
      }),
    };
  }

  let executableConnection = connection;
  let secrets = new Map<string, string>();
  const startedAtDate = new Date();
  const startedAt = Date.now();
  let httpStatus: number | null = null;
  let responsePreview = "";

  await updateRun({
    runId: run.id,
    status: "running",
    startedAt: startedAtDate,
    durationMs: 0,
  });
  await insertRunLog({
    runId: run.id,
    connectionId: connection.id,
    message: "Run started.",
  });

  try {
    if (connection.provider === GOOGLE_SHEETS_PROVIDER) {
      executableConnection = (
        await synchronizeGoogleSheetsConnectionTab(connection)
      ).connection;
    }
    secrets = await readVaultSecret(executableConnection.secretVaultId);

    await insertRunLog({
      runId: run.id,
      connectionId: executableConnection.id,
      message: "Fetching upstream API.",
    });

    const requestConfig = createApiConnectionRunRequest({
      method: executableConnection.method,
      url: executableConnection.url,
      requestHeaders: executableConnection.requestHeaders,
      bodyTemplate: executableConnection.bodyTemplate,
      secrets,
    });

    const provider = resolveConnectionProvider({
      connection: executableConnection,
      requestUrl: requestConfig.url,
    });
    const result = await provider.fetch({
      connection: executableConnection,
      requestConfig,
      secrets,
      log: async (message) => {
        await insertRunLog({
          runId: run.id,
          connectionId: executableConnection.id,
          message,
        });
      },
      onHttpStatus: (status) => {
        httpStatus = status;
      },
    });
    const body = result.body;
    let parsed = result.parsed;

    httpStatus = result.httpStatus ?? httpStatus;

    responsePreview = previewResponse(body, secrets);
    const redactedBody = redactSecrets(body, secrets);

    await insertRunLog({
      runId: run.id,
      connectionId: connection.id,
      message: `Received HTTP ${httpStatus}.`,
    });

    parsed ??= provider.parse({ body, connection: executableConnection });

    await insertRunLog({
      runId: run.id,
      connectionId: connection.id,
      message: `Parsed ${parsed.rows.length} rows.`,
    });

    let datasetId: string | null = null;

    if (run.mode === "import" && connection.id !== IMB_API_CONNECTION_ID) {
      const dataset = await persistImportedRows({
        identity: identityFromRun(run),
        connection: executableConnection,
        rows: parsed.rows,
        columns: parsed.columns,
      });

      datasetId = dataset?.id ?? null;
      await insertRunLog({
        runId: run.id,
        connectionId: connection.id,
        message: datasetId ? "Imported dataset rows." : "Import completed.",
      });
    } else if (run.mode === "import") {
      await insertRunLog({
        runId: run.id,
        connectionId: connection.id,
        message: "Archived IMB source rows for forming; no dataset was published.",
      });
    }

    await persistRunOutput({
      run,
      connection: executableConnection,
      parsed,
      redactedBody,
      httpStatus,
    });

    await insertRunLog({
      runId: run.id,
      connectionId: executableConnection.id,
      message: "Archived output artifacts.",
    });

    const resourceCount = await publishApiConnectionResources({
      connectionId: connection.id,
      runId: run.id,
      rows: parsed.rows,
    });

    if (resourceCount > 0) {
      await insertRunLog({
        runId: run.id,
        connectionId: connection.id,
        message: `Published ${resourceCount} resources.`,
      });
    }

    await updateRun({
      runId: run.id,
      status: "success",
      httpStatus,
      durationMs: Date.now() - startedAt,
      rowCount: parsed.rows.length,
      datasetId,
      errorMessage: null,
      responsePreview,
      startedAt: startedAtDate,
      completedAt: new Date(),
    });

    await getDb()
      .update(apiConnections)
      .set({ updatedAt: new Date(), updatedByOwnerId: run.actorOwnerId })
      .where(eq(apiConnections.id, executableConnection.id));

    await insertRunLog({
      runId: run.id,
      connectionId: connection.id,
      message: "Run completed.",
    });

    const [updatedConnection] = await getDb()
      .select()
      .from(apiConnections)
      .where(eq(apiConnections.id, executableConnection.id))
      .limit(1);

    return {
      connection: toApiConnection(updatedConnection),
      run: (await getApiConnectionRunDetail({
        connectionId: connection.id,
        runId: run.id,
      }))!,
    };
  } catch (error) {
    const message =
      error instanceof ApiConnectionError
        ? error.message
        : error instanceof GoogleSheetsError
          ? error.message
        : error instanceof Error && error.name === "AbortError"
          ? "API request timed out."
          : "API connection run failed.";

    if (!(error instanceof ApiConnectionError) && !(error instanceof GoogleSheetsError)) {
      logError("Failed to run API connection", error);
    }

    await updateRun({
      runId: run.id,
      status: "failed",
      httpStatus,
      durationMs: Date.now() - startedAt,
      rowCount: null,
      datasetId: null,
      errorMessage: redactSecrets(message, secrets),
      responsePreview,
      startedAt: startedAtDate,
      completedAt: new Date(),
    });
    await insertRunLog({
      runId: run.id,
      connectionId: connection.id,
      level: "error",
      message: redactSecrets(message, secrets),
    });

    return {
      connection: toApiConnection(connection),
      run: await getApiConnectionRunDetail({
        connectionId: connection.id,
        runId: run.id,
      }),
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

  return hydrateRunDetails(rows);
}

export async function getApiConnectionRunDetail(input: {
  connectionId: string;
  runId: string;
}): Promise<ApiConnectionRun | null> {
  const rows = await getDb()
    .select()
    .from(apiConnectionRuns)
    .where(
      and(
        eq(apiConnectionRuns.connectionId, input.connectionId),
        eq(apiConnectionRuns.id, input.runId),
      ),
    )
    .limit(1);
  const [run] = await hydrateRunDetails(rows);

  return run ?? null;
}

async function downloadStorageText(path: string) {
  const supabase = createSupabaseAdminClient();

  for (const bucket of getApiConnectionRunArtifactReadBuckets()) {
    const result = await supabase.storage.from(bucket).download(path);

    if (!result.error) {
      return result.data.text();
    }

    if (result.error.status !== 404) {
      throw result.error;
    }
  }

  throw Object.assign(new Error("API connection run artifact was not found."), {
    status: 404,
  });
}

function getOutputFileName(input: { runId: string; format: "json" | "csv" }) {
  return `api-connection-run-${input.runId}.${input.format}`;
}

export async function getApiConnectionRunOutputDownload(input: {
  connectionId: string;
  runId: string;
  format: "json" | "csv";
}) {
  const [output] = await getDb()
    .select()
    .from(apiConnectionRunOutputs)
    .where(
      and(
        eq(apiConnectionRunOutputs.connectionId, input.connectionId),
        eq(apiConnectionRunOutputs.runId, input.runId),
      ),
    )
    .limit(1);

  if (!output) {
    return null;
  }

  if (input.format === "json") {
    return {
      body: await downloadStorageText(output.rawStoragePath),
      contentType: "application/json; charset=utf-8",
      fileName: getOutputFileName({ runId: input.runId, format: "json" }),
    };
  }

  const rowsArtifact = parseApiConnectionRowsArtifact(
    await downloadStorageText(output.rowsStoragePath),
  );

  return {
    body: serializeApiConnectionRowsToCsv(rowsArtifact),
    contentType: "text/csv; charset=utf-8",
    fileName: getOutputFileName({ runId: input.runId, format: "csv" }),
  };
}
