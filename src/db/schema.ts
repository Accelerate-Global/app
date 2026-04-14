import { sql } from "drizzle-orm";

import type { CsvColumn, DatasetStatus, DatasetTag } from "@/lib/api-types";
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

export const filterRegions = pgTable(
  "filter_regions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
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
