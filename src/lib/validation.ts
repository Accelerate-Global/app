import { z } from "zod";

import { MAX_CSV_BYTES, ROW_BATCH_SIZE } from "@/lib/csv";
import {
  DEFAULT_HOTSPOTS_COUNTRY_COUNT,
  DEFAULT_HOTSPOTS_METRIC,
  MAX_HOTSPOTS_COUNTRY_COUNT,
} from "@/lib/dataset-region-filtering";
import {
  POPULATION_BELIEVERS_RULE_MAX_TIERS,
  POPULATION_BELIEVERS_RULE_MIN_TIERS,
} from "@/lib/evangelical-population-believers-rule";
import { WORKSPACE_ROLES } from "@/lib/workspace-role";

export const csvColumnSchema = z.object({
  key: z.string().min(1).max(128),
  label: z.string().min(1).max(256),
  sourceIndex: z.number().int().nonnegative(),
});

export const datasetHiddenColumnKeySchema = z.string().trim().min(1).max(128);

const filterRegionCountrySchema = z.string().trim().min(1).max(255);
const savedDatasetRegionNameSchema = z.string().trim().min(1).max(80);

const savedDatasetSortSchema = z.object({
  id: datasetHiddenColumnKeySchema,
  desc: z.boolean(),
});

const savedDatasetRegionFilterStateSchema = z
  .object({
    enabled: z.boolean(),
    selectedRegionIds: z.array(z.string().uuid()).max(500),
    selectedRegionNames: z.array(savedDatasetRegionNameSchema).max(500),
    enabledCountryNames: z.array(filterRegionCountrySchema).max(500),
  })
  .superRefine((value, ctx) => {
    const normalizedRegionIds = value.selectedRegionIds.map((regionId) =>
      regionId.trim().toLowerCase(),
    );
    const normalizedRegionNames = value.selectedRegionNames.map((regionName) =>
      regionName.trim().toLowerCase(),
    );
    const normalizedCountryNames = value.enabledCountryNames.map((countryName) =>
      countryName.trim().toLowerCase(),
    );

    if (new Set(normalizedRegionIds).size !== normalizedRegionIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedRegionIds"],
        message: "Each selected region can only be included once.",
      });
    }

    if (new Set(normalizedRegionNames).size !== normalizedRegionNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedRegionNames"],
        message: "Each selected region name can only be included once.",
      });
    }

    if (new Set(normalizedCountryNames).size !== normalizedCountryNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enabledCountryNames"],
        message: "Each enabled country can only be included once.",
      });
    }
  });

const savedDatasetCountryFilterStateSchema = z
  .object({
    enabled: z.boolean(),
    selectedCountryNames: z.array(filterRegionCountrySchema).max(500),
    includeAlternateCountries: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    const normalizedCountryNames = value.selectedCountryNames.map((countryName) =>
      countryName.trim().toLowerCase(),
    );

    if (new Set(normalizedCountryNames).size !== normalizedCountryNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedCountryNames"],
        message: "Each selected country can only be included once.",
      });
    }
  });

const populationBelieversTierSchema = z.object({
  minPopulation: z.number().int().min(0),
  maxPopulation: z.number().int().min(0).nullable(),
  minBelievers: z.number().int().min(0),
});

const populationBelieversRuleSchema = z
  .object({
    tiers: z
      .array(populationBelieversTierSchema)
      .min(POPULATION_BELIEVERS_RULE_MIN_TIERS)
      .max(POPULATION_BELIEVERS_RULE_MAX_TIERS),
  })
  .superRefine((value, ctx) => {
    value.tiers.forEach((tier, index) => {
      if (index === 0 && tier.minPopulation !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers", index, "minPopulation"],
          message: "The first tier must start at population 0.",
        });
      }

      if (tier.maxPopulation === null && index !== value.tiers.length - 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers", index, "maxPopulation"],
          message: "Only the final tier can be open-ended.",
        });
      }

      if (tier.maxPopulation !== null && tier.maxPopulation < tier.minPopulation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers", index, "maxPopulation"],
          message: "Each tier must include at least one population value.",
        });
      }

      if (index === value.tiers.length - 1 && tier.maxPopulation !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers", index, "maxPopulation"],
          message: "The final tier must be open-ended.",
        });
      }

      if (index === 0) {
        return;
      }

      const previousTier = value.tiers[index - 1];
      const expectedMinPopulation =
        previousTier.maxPopulation === null ? null : previousTier.maxPopulation + 1;

      if (expectedMinPopulation === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers", index, "minPopulation"],
          message: "No tiers can follow an open-ended tier.",
        });
        return;
      }

      if (tier.minPopulation !== expectedMinPopulation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tiers", index, "minPopulation"],
          message: "Tiers must stay sorted and contiguous without gaps or overlap.",
        });
      }
    });
  });

const savedDatasetWatchlistFilterStateSchema = z.object({
  enabled: z.boolean(),
  thresholdEnabled: z.boolean().optional().default(true),
  threshold: z.number().int().min(0).max(6),
  engagementPhaseEnabled: z.boolean().optional().default(true),
  engagementPhaseThreshold: z.number().int().min(0).max(7),
  evangelicalPopulationBelieversRuleEnabled: z.boolean().optional().default(true),
  evangelicalPopulationBelieversRule: populationBelieversRuleSchema.optional(),
  evangelicalBelieversEnabled: z.boolean().optional(),
  evangelicalBelieversThreshold: z.number().int().min(0).max(1_000_000_000).optional(),
  evangelicalPercentEnabled: z.boolean().optional(),
  evangelicalPercentThreshold: z.number().min(0).max(100).optional(),
  frontierGroupEnabled: z.boolean().optional().default(true),
  frontierGroupValue: z.boolean().optional().default(true),
});

const savedDatasetHotspotsFilterStateSchema = z.object({
  enabled: z.boolean().optional().default(false),
  metric: z
    .enum(["unique_uupgs", "population"])
    .optional()
    .default(DEFAULT_HOTSPOTS_METRIC),
  countryCount: z
    .number()
    .int()
    .min(1)
    .max(MAX_HOTSPOTS_COUNTRY_COUNT)
    .optional()
    .default(DEFAULT_HOTSPOTS_COUNTRY_COUNT),
});

export const datasetTagSchema = z.object({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(40),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
});

export const savedDatasetFilterStateSchema = z.object({
  region: savedDatasetRegionFilterStateSchema,
  country: savedDatasetCountryFilterStateSchema,
  watchlist: savedDatasetWatchlistFilterStateSchema,
  uupg: z.object({
    enabled: z.boolean(),
  }),
  hotspots: savedDatasetHotspotsFilterStateSchema.optional().default({
    enabled: false,
    metric: DEFAULT_HOTSPOTS_METRIC,
    countryCount: DEFAULT_HOTSPOTS_COUNTRY_COUNT,
  }),
  sorting: z.array(savedDatasetSortSchema).max(8),
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

export const replaceDatasetSchema = createDatasetSchema.omit({
  fileName: true,
});

export const rowBatchSchema = z.object({
  startIndex: z.number().int().nonnegative(),
  rows: z.array(z.record(z.string(), z.string())).max(ROW_BATCH_SIZE),
  isFinalBatch: z.boolean().default(false),
  totalRows: z.number().int().nonnegative().optional(),
});

export const datasetAssignDerivedViewSchema = z.object({
  sourceDatasetId: z.string().uuid(),
  filters: savedDatasetFilterStateSchema,
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
    sourceOrganizationName: z
      .union([z.string().trim().min(1).max(255), z.null()])
      .optional(),
    tags: z.array(datasetTagSchema).max(24).optional(),
    isPrimary: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    hiddenColumnKeys: z.array(datasetHiddenColumnKeySchema).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.fileName === undefined &&
      value.sourceOrganizationName === undefined &&
      value.tags === undefined &&
      value.isPrimary === undefined &&
      value.isPublic === undefined &&
      value.hiddenColumnKeys === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A dataset update must include a name, organization label, tags, primary flag, public visibility, or visible fields.",
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

export const savedDatasetTableCreateSchema = z.object({
  datasetId: z.string().uuid(),
  savedRowCount: z.number().int().nonnegative(),
  filters: savedDatasetFilterStateSchema,
});

export const savedDatasetTableUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    details: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.name === undefined && value.details === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A saved table update must include a name or details.",
      });
    }
  });

export const fieldDefinitionPatchSchema = z.object({
  displayLabel: z.string().trim().max(256),
  definition: z.string().trim().max(1000),
  hideFromViewerFieldDefinitions: z.boolean(),
});

export const datasetPatchSchema = z.union([
  datasetStatusPatchSchema,
  datasetMetadataPatchSchema,
]);

export const workspaceUserInviteSchema = z.object({
  email: z.string().trim().min(1).email().max(255),
  fullName: z.string().trim().max(120).optional(),
  workspaceRole: z.enum(WORKSPACE_ROLES),
});

export const workspaceUserPatchSchema = z
  .object({
    workspaceRole: z.enum(WORKSPACE_ROLES).optional(),
    disabled: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.workspaceRole === undefined &&
      value.disabled === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A user update must include a role change or a status change.",
      });
    }
  });
