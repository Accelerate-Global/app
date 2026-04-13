import { z } from "zod";

import { MAX_CSV_BYTES, ROW_BATCH_SIZE } from "@/lib/csv";

export const csvColumnSchema = z.object({
  key: z.string().min(1).max(128),
  label: z.string().min(1).max(256),
  sourceIndex: z.number().int().nonnegative(),
});

export const blobUploadTokenSchema = z.object({
  fileName: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_CSV_BYTES),
  contentType: z.string().min(1).max(128).optional(),
});

export const createDatasetSchema = z.object({
  fileName: z.string().min(1).max(255),
  blobPath: z.string().min(1).max(1024),
  sizeBytes: z.number().int().positive().max(MAX_CSV_BYTES),
  columns: z.array(csvColumnSchema).min(1).max(500),
});

export const rowBatchSchema = z.object({
  startIndex: z.number().int().nonnegative(),
  rows: z.array(z.record(z.string(), z.string())).max(ROW_BATCH_SIZE),
  isFinalBatch: z.boolean().default(false),
  totalRows: z.number().int().nonnegative().optional(),
});

export const datasetPatchSchema = z.object({
  status: z.enum(["processing", "ready", "failed"]),
  error: z.string().max(1000).nullable().optional(),
});
