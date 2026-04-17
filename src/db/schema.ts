import { sql } from "drizzle-orm";

import type { CsvColumn, DatasetStatus, DatasetTag } from "@/lib/api-types";
import type { SavedDatasetFilterState } from "@/lib/api-types";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    fileName: text("file_name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    blobUrl: text("blob_url").notNull(),
    blobPath: text("blob_path").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").$type<DatasetStatus>().notNull().default("processing"),
    rowCount: integer("row_count").notNull().default(0),
    sizeBytes: integer("size_bytes").notNull(),
    columns: jsonb("columns").$type<CsvColumn[]>().notNull(),
    hiddenColumnKeys: jsonb("hidden_column_keys")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
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
