import { z } from "zod";

import { MAX_CSV_BYTES, ROW_BATCH_SIZE } from "@/lib/csv";

export const csvColumnSchema = z.object({
  key: z.string().min(1).max(128),
  label: z.string().min(1).max(256),
  sourceIndex: z.number().int().nonnegative(),
});

export const datasetTagSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(40),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
});

export const datasetHiddenColumnKeySchema = z.string().trim().min(1).max(128);

const filterRegionCountrySchema = z.string().trim().min(1).max(255);

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

export const datasetStatusPatchSchema = z.object({
  status: z.enum(["processing", "ready", "failed"]),
  error: z.string().max(1000).nullable().optional(),
});

export const datasetRenamePatchSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
});

export const datasetMetadataPatchSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255).optional(),
    tags: z.array(datasetTagSchema).max(24).optional(),
    isPrimary: z.boolean().optional(),
    hiddenColumnKeys: z.array(datasetHiddenColumnKeySchema).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.fileName === undefined &&
      value.tags === undefined &&
      value.isPrimary === undefined &&
      value.hiddenColumnKeys === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A dataset update must include a name, tags, primary flag, or visible fields.",
      });
    }

    if (value.hiddenColumnKeys) {
      const normalizedKeys = value.hiddenColumnKeys.map((key) =>
        key.trim().toLowerCase(),
      );

      if (new Set(normalizedKeys).size !== normalizedKeys.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hiddenColumnKeys"],
          message: "Each hidden field can only be selected once.",
        });
      }
    }
  });

export const datasetReorderSchema = z.object({
  datasetIds: z
    .array(z.string().uuid())
    .min(1)
    .refine((datasetIds) => new Set(datasetIds).size === datasetIds.length, {
      message: "Dataset order must not contain duplicates.",
    }),
});

export const filterRegionPayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300),
    sortOrder: z.number().int().min(1).max(9999),
    countries: z.array(filterRegionCountrySchema).min(1).max(500),
  })
  .superRefine((value, ctx) => {
    const normalizedCountries = value.countries.map((country) =>
      country.trim().toLowerCase(),
    );

    if (new Set(normalizedCountries).size !== normalizedCountries.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countries"],
        message: "Each country can only be selected once.",
      });
    }
  });

export const fieldDefinitionPatchSchema = z.object({
  displayLabel: z.string().trim().max(256),
  definition: z.string().trim().max(1000),
  hideFromViewerFieldDefinitions: z.boolean(),
});

export const fieldSourcePatchSchema = z.object({
  sourceTypeId: z.string().uuid(),
  sourceFieldName: z.string().trim().max(255),
});

export const fieldSourceTypeCreateSchema = z.object({
  label: z.string().trim().min(1).max(64),
});

export const datasetPatchSchema = z.union([
  datasetStatusPatchSchema,
  datasetMetadataPatchSchema,
]);
