import { sql } from "drizzle-orm";

import type {
  ApiConnectionHeader,
  ApiConnectionImportMode,
  ApiConnectionMethod,
  ApiConnectionResponseFormat,
  ApiConnectionRunLogLevel,
  ApiConnectionRunMode,
  ApiConnectionRunStatus,
  CsvColumn,
  DatasetStatus,
  DatasetTag,
  DatasetVersionAction,
} from "@/lib/api-types";
import type { SavedDatasetFilterState } from "@/lib/api-types";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { AnalyticsWorkspaceRole, AppAnalyticsRoute } from "@/lib/analytics";
import type { AnalyticsFailureTriageStatus } from "@/lib/analytics-failure-triage";

export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    backingDatasetId: uuid("backing_dataset_id").references(
      (): AnyPgColumn => datasets.id,
      {
        onDelete: "restrict",
      },
    ),
    fileName: text("file_name").notNull(),
    sourceOrganizationName: text("source_organization_name"),
    sortOrder: integer("sort_order").notNull().default(0),
    blobUrl: text("blob_url").notNull(),
    blobPath: text("blob_path").notNull(),
    currentVersionAction: text("current_version_action")
      .$type<DatasetVersionAction>()
      .notNull()
      .default("upload"),
    currentVersionActorOwnerId: text("current_version_actor_owner_id").notNull(),
    currentVersionActorEmail: text("current_version_actor_email"),
    currentVersionCreatedAt: timestamp("current_version_created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(true),
    status: text("status").$type<DatasetStatus>().notNull().default("processing"),
    rowCount: integer("row_count").notNull().default(0),
    sizeBytes: integer("size_bytes").notNull(),
    columns: jsonb("columns").$type<CsvColumn[]>().notNull(),
    hiddenColumnKeys: jsonb("hidden_column_keys")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    defaultFilters: jsonb("default_filters").$type<SavedDatasetFilterState | null>(),
    tags: jsonb("tags").$type<DatasetTag[]>().notNull().default(sql`'[]'::jsonb`),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("datasets_owner_created_idx").on(table.ownerId, table.createdAt),
    index("datasets_backing_dataset_idx").on(table.backingDatasetId),
    index("datasets_sort_order_idx").on(table.sortOrder, table.createdAt),
  ],
);

export const datasetRows = pgTable(
  "dataset_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("dataset_rows_dataset_row_idx").on(
      table.datasetId,
      table.rowIndex,
    ),
    index("dataset_rows_dataset_idx").on(table.datasetId),
  ],
);

export const datasetVersions = pgTable(
  "dataset_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    blobUrl: text("blob_url").notNull(),
    blobPath: text("blob_path").notNull(),
    action: text("action").$type<DatasetVersionAction>().notNull(),
    actorOwnerId: text("actor_owner_id").notNull(),
    actorEmail: text("actor_email"),
    status: text("status").$type<DatasetStatus>().notNull(),
    rowCount: integer("row_count").notNull().default(0),
    sizeBytes: integer("size_bytes").notNull(),
    columns: jsonb("columns").$type<CsvColumn[]>().notNull(),
    error: text("error"),
    versionCreatedAt: timestamp("version_created_at", { withTimezone: true })
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("dataset_versions_dataset_version_created_idx").on(
      table.datasetId,
      table.versionCreatedAt,
      table.archivedAt,
    ),
    index("dataset_versions_dataset_archived_idx").on(
      table.datasetId,
      table.archivedAt,
    ),
  ],
);

export const datasetVersionRows = pgTable(
  "dataset_version_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => datasetVersions.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("dataset_version_rows_version_row_idx").on(
      table.versionId,
      table.rowIndex,
    ),
    index("dataset_version_rows_version_idx").on(table.versionId),
  ],
);

export const savedDatasetTables = pgTable(
  "saved_dataset_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    details: text("details").notNull().default(""),
    filters: jsonb("filters").$type<SavedDatasetFilterState>().notNull(),
    savedRowCount: integer("saved_row_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("saved_dataset_tables_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
    index("saved_dataset_tables_owner_dataset_idx").on(
      table.ownerId,
      table.datasetId,
      table.createdAt,
    ),
    index("saved_dataset_tables_dataset_idx").on(table.datasetId),
  ],
);

export const filterRegions = pgTable(
  "filter_regions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("filter_regions_name_lower_idx").on(
      sql`lower(btrim(${table.name}))`,
    ),
    index("filter_regions_sort_order_idx").on(table.sortOrder, table.createdAt),
  ],
);

export const filterRegionCountries = pgTable(
  "filter_region_countries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => filterRegions.id, { onDelete: "cascade" }),
    countryName: text("country_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("filter_region_countries_region_idx").on(table.regionId),
    uniqueIndex("filter_region_countries_region_country_lower_idx").on(
      table.regionId,
      sql`lower(btrim(${table.countryName}))`,
    ),
  ],
);

export const fieldDefinitions = pgTable(
  "field_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalKey: text("canonical_key").notNull(),
    label: text("label").notNull(),
    displayLabel: text("display_label").notNull().default(""),
    definition: text("definition").notNull().default(""),
    hideFromViewerFieldDefinitions: boolean("hide_from_viewer_field_definitions")
      .notNull()
      .default(false),
    mappingFieldId: text("mapping_field_id"),
    mappingDataType: text("mapping_data_type"),
    mappingIsActive: boolean("mapping_is_active"),
    sourcePriorityKeys: jsonb("source_priority_keys")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("field_definitions_canonical_key_idx").on(table.canonicalKey),
    index("field_definitions_label_lower_idx").on(
      sql`lower(btrim(${table.label}))`,
      table.createdAt,
    ),
  ],
);

export const fieldSourceTypes = pgTable(
  "field_source_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("field_source_types_key_idx").on(table.key),
    uniqueIndex("field_source_types_label_lower_idx").on(
      sql`lower(btrim(${table.label}))`,
    ),
    index("field_source_types_sort_order_idx").on(table.sortOrder, table.createdAt),
  ],
);

export const fieldDefinitionSources = pgTable(
  "field_definition_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fieldDefinitionId: uuid("field_definition_id")
      .notNull()
      .references(() => fieldDefinitions.id, { onDelete: "cascade" }),
    sourceTypeId: uuid("source_type_id")
      .notNull()
      .references(() => fieldSourceTypes.id, { onDelete: "cascade" }),
    sourceFieldName: text("source_field_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("field_definition_sources_field_source_idx").on(
      table.fieldDefinitionId,
      table.sourceTypeId,
    ),
    index("field_definition_sources_source_type_idx").on(table.sourceTypeId),
  ],
);

export const signupEmailAllowlist = pgTable("signup_email_allowlist", {
  email: text("email").primaryKey(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

const privateSchema = pgSchema("private");

export const apiConnections = privateSchema.table(
  "api_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    method: text("method").$type<ApiConnectionMethod>().notNull().default("GET"),
    url: text("url").notNull(),
    requestHeaders: jsonb("request_headers")
      .$type<ApiConnectionHeader[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    secretHeaderNames: jsonb("secret_header_names")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    secretVaultId: uuid("secret_vault_id"),
    bodyTemplate: text("body_template").notNull().default(""),
    responseFormat: text("response_format")
      .$type<ApiConnectionResponseFormat>()
      .notNull()
      .default("json"),
    responseDataPath: text("response_data_path").notNull().default(""),
    importMode: text("import_mode")
      .$type<ApiConnectionImportMode>()
      .notNull()
      .default("create"),
    targetDatasetId: uuid("target_dataset_id").references(() => datasets.id, {
      onDelete: "set null",
    }),
    datasetName: text("dataset_name").notNull().default("api-import.csv"),
    datasetClassification: text("dataset_classification")
      .$type<"PGAC" | "PGIC">()
      .notNull()
      .default("PGAC"),
    createdByOwnerId: text("created_by_owner_id").notNull(),
    updatedByOwnerId: text("updated_by_owner_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("api_connections_created_at_idx").on(table.createdAt),
    index("api_connections_updated_at_idx").on(table.updatedAt),
  ],
);

export const apiConnectionRuns = privateSchema.table(
  "api_connection_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => apiConnections.id, { onDelete: "cascade" }),
    actorOwnerId: text("actor_owner_id").notNull(),
    actorEmail: text("actor_email"),
    mode: text("mode").$type<ApiConnectionRunMode>().notNull(),
    status: text("status").$type<ApiConnectionRunStatus>().notNull(),
    httpStatus: integer("http_status"),
    durationMs: integer("duration_ms").notNull(),
    rowCount: integer("row_count"),
    datasetId: uuid("dataset_id").references(() => datasets.id, {
      onDelete: "set null",
    }),
    errorMessage: text("error_message"),
    responsePreview: text("response_preview").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("api_connection_runs_connection_created_idx").on(
      table.connectionId,
      table.createdAt,
    ),
    index("api_connection_runs_created_at_idx").on(table.createdAt),
  ],
);

export const apiConnectionRunLogs = privateSchema.table(
  "api_connection_run_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => apiConnectionRuns.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => apiConnections.id, { onDelete: "cascade" }),
    level: text("level").$type<ApiConnectionRunLogLevel>().notNull().default("info"),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("api_connection_run_logs_run_created_idx").on(
      table.runId,
      table.createdAt,
    ),
    index("api_connection_run_logs_connection_created_idx").on(
      table.connectionId,
      table.createdAt,
    ),
  ],
);

export const apiConnectionRunOutputs = privateSchema.table(
  "api_connection_run_outputs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => apiConnectionRuns.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => apiConnections.id, { onDelete: "cascade" }),
    rowCount: integer("row_count").notNull().default(0),
    columns: jsonb("columns").$type<CsvColumn[]>().notNull().default(sql`'[]'::jsonb`),
    rowsStoragePath: text("rows_storage_path").notNull(),
    rawStoragePath: text("raw_storage_path").notNull(),
    rowsSizeBytes: integer("rows_size_bytes").notNull().default(0),
    rawSizeBytes: integer("raw_size_bytes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("api_connection_run_outputs_run_idx").on(table.runId),
    index("api_connection_run_outputs_connection_created_idx").on(
      table.connectionId,
      table.createdAt,
    ),
  ],
);

export const apiConnectionResources = privateSchema.table(
  "api_connection_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => apiConnections.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => apiConnectionRuns.id, { onDelete: "cascade" }),
    resourceUrl: text("resource_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    webText: text("web_text").notNull().default(""),
    sourceRowIndex: integer("source_row_index").notNull(),
    sourceResourceIndex: integer("source_resource_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("api_connection_resources_run_url_idx").on(
      table.connectionId,
      table.runId,
      table.normalizedUrl,
    ),
    index("api_connection_resources_created_idx").on(table.createdAt),
    index("api_connection_resources_connection_created_idx").on(
      table.connectionId,
      table.createdAt,
    ),
  ],
);

export const isoCountryCodeEntryOverrides = privateSchema.table(
  "iso_country_code_entry_overrides",
  {
    displayName: text("display_name").primaryKey(),
    alternativeNames: jsonb("alternative_names")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    updatedByOwnerId: text("updated_by_owner_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("iso_country_code_entry_overrides_updated_idx").on(table.updatedAt),
  ],
);

export const analyticsEvents = privateSchema.table(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventName: text("event_name").notNull(),
    route: text("route").$type<AppAnalyticsRoute>().notNull(),
    sourceSurface: text("source_surface").notNull(),
    actorOwnerId: text("actor_owner_id").notNull(),
    workspaceRole: text("workspace_role")
      .$type<AnalyticsWorkspaceRole>()
      .notNull(),
    success: boolean("success").notNull(),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    datasetId: uuid("dataset_id"),
    savedTableId: uuid("saved_table_id"),
    targetUserId: text("target_user_id"),
    eventProps: jsonb("event_props")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_events_created_at_idx").on(table.createdAt),
    index("analytics_events_event_name_created_at_idx").on(
      table.eventName,
      table.createdAt,
    ),
    index("analytics_events_route_created_at_idx").on(table.route, table.createdAt),
    index("analytics_events_success_created_at_idx").on(
      table.success,
      table.createdAt,
    ),
    index("analytics_events_actor_owner_created_at_idx").on(
      table.actorOwnerId,
      table.createdAt,
    ),
  ],
);

export const analyticsFailureTriage = privateSchema.table(
  "analytics_failure_triage",
  {
    fingerprint: text("fingerprint").primaryKey(),
    status: text("status")
      .$type<AnalyticsFailureTriageStatus>()
      .notNull()
      .default("needs_review"),
    note: text("note").notNull().default(""),
    triagedByOwnerId: text("triaged_by_owner_id").notNull(),
    triagedAt: timestamp("triaged_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analytics_failure_triage_status_triaged_at_idx").on(
      table.status,
      table.triagedAt,
    ),
    index("analytics_failure_triage_updated_at_idx").on(table.updatedAt),
  ],
);
