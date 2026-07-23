import { z } from "zod";

export const PIPELINE_RESOURCE_SCHEMA_VERSION = 1 as const;

export const SOURCE_ALIASES_RESOURCE_KEY = "source-aliases" as const;
export const JP_PEOPLE_ID3_RESOURCE_KEY = "jp-peopleid3" as const;
export const PEID_RESOURCE_KEY = "peid" as const;
export const TIER1_MERGE_PRIORITIES_RESOURCE_KEY =
  "tier1-merge-priorities" as const;
export const ENGAGEMENT_MAPPINGS_RESOURCE_KEY =
  "engagement-mappings" as const;

export const PIPELINE_RESOURCE_KEYS = [
  SOURCE_ALIASES_RESOURCE_KEY,
  JP_PEOPLE_ID3_RESOURCE_KEY,
  PEID_RESOURCE_KEY,
  TIER1_MERGE_PRIORITIES_RESOURCE_KEY,
  ENGAGEMENT_MAPPINGS_RESOURCE_KEY,
] as const;

export type PipelineResourceKey = (typeof PIPELINE_RESOURCE_KEYS)[number];

export function isPipelineResourceKey(value: string): value is PipelineResourceKey {
  return (PIPELINE_RESOURCE_KEYS as readonly string[]).includes(value);
}

const nonEmptyTextSchema = z.string().trim().min(1);
const fieldIdSchema = z.string().regex(/^F_\d+$/u);
const canonicalSourceKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u);
const sourceInitialsSchema = z.string().regex(/^[a-z0-9]{1,8}$/u);
const canonicalFieldSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/u);
const numericIdentifierSchema = z.string().regex(/^\d+$/u);
const rop3Schema = z.string().regex(/^\d{6}$/u);
const rop1Schema = z.string().regex(/^[A-Z]\d{3}$/u);
const iso3Schema = z.string().regex(/^[A-Z]{3}$/u);
const sourceTimestampSchema = z.iso.datetime({ offset: true });

const pipelineResourceBaseSchema = z.object({
  schemaVersion: z.literal(PIPELINE_RESOURCE_SCHEMA_VERSION),
  sourceName: nonEmptyTextSchema,
  sourceRetrievedAt: sourceTimestampSchema,
});

export const sourceAliasRowSchema = z
  .object({
    fieldId: fieldIdSchema,
    canonicalSourceKey: canonicalSourceKeySchema,
    displayName: nonEmptyTextSchema,
    initials: sourceInitialsSchema,
    aliases: z.array(nonEmptyTextSchema),
    active: z.boolean(),
  })
  .strict();

export const sourceAliasResourceSchema = pipelineResourceBaseSchema
  .extend({
    resourceKey: z.literal(SOURCE_ALIASES_RESOURCE_KEY),
    entries: z.array(sourceAliasRowSchema).min(1),
  })
  .strict();

const parentStatusSchema = z.enum(["linked", "approved-missing"]);

export const jpPeopleId3RowSchema = z
  .object({
    peopleId3: numericIdentifierSchema,
    rop3: rop3Schema.nullable(),
    iso3: iso3Schema.nullable(),
    active: z.boolean(),
    parentStatus: parentStatusSchema,
    missingParentReason: nonEmptyTextSchema.nullable(),
  })
  .strict();

export const jpPeopleId3ResourceSchema = pipelineResourceBaseSchema
  .extend({
    resourceKey: z.literal(JP_PEOPLE_ID3_RESOURCE_KEY),
    entries: z.array(jpPeopleId3RowSchema).min(1),
  })
  .strict();

export const peidRowSchema = z
  .object({
    peid: numericIdentifierSchema,
    peopleName: nonEmptyTextSchema,
    iso3: iso3Schema.nullable(),
    rop3: rop3Schema.nullable(),
    rop1: rop1Schema.nullable(),
    active: z.boolean(),
    parentStatus: parentStatusSchema,
    missingParentReason: nonEmptyTextSchema.nullable(),
  })
  .strict();

export const peidResourceSchema = pipelineResourceBaseSchema
  .extend({
    resourceKey: z.literal(PEID_RESOURCE_KEY),
    entries: z.array(peidRowSchema).min(1),
  })
  .strict();

export const tier1MergePriorityRowSchema = z
  .object({
    fieldId: fieldIdSchema,
    canonicalField: canonicalFieldSchema,
    displayName: nonEmptyTextSchema,
    active: z.boolean(),
    prioritySourceKeys: z.array(canonicalSourceKeySchema),
  })
  .strict();

export const tier1MergePrioritiesResourceSchema = pipelineResourceBaseSchema
  .extend({
    resourceKey: z.literal(TIER1_MERGE_PRIORITIES_RESOURCE_KEY),
    entries: z.array(tier1MergePriorityRowSchema).min(1),
  })
  .strict();

export const pipelineSemanticTypeSchema = z.enum([
  "string",
  "boolean",
  "integer",
  "double",
  "date",
  "identifier",
]);

export const engagementMappingRowSchema = z
  .object({
    fieldId: fieldIdSchema,
    sourceField: nonEmptyTextSchema,
    canonicalField: canonicalFieldSchema,
    displayName: nonEmptyTextSchema,
    active: z.boolean(),
    dataType: pipelineSemanticTypeSchema,
  })
  .strict();

export const engagementMappingsResourceSchema = pipelineResourceBaseSchema
  .extend({
    resourceKey: z.literal(ENGAGEMENT_MAPPINGS_RESOURCE_KEY),
    entries: z.array(engagementMappingRowSchema).min(1),
  })
  .strict();

export const pipelineResourceSchemas = {
  [SOURCE_ALIASES_RESOURCE_KEY]: sourceAliasResourceSchema,
  [JP_PEOPLE_ID3_RESOURCE_KEY]: jpPeopleId3ResourceSchema,
  [PEID_RESOURCE_KEY]: peidResourceSchema,
  [TIER1_MERGE_PRIORITIES_RESOURCE_KEY]:
    tier1MergePrioritiesResourceSchema,
  [ENGAGEMENT_MAPPINGS_RESOURCE_KEY]: engagementMappingsResourceSchema,
} as const;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type SourceAliasRow = DeepReadonly<z.infer<typeof sourceAliasRowSchema>>;
export type JpPeopleId3Row = DeepReadonly<z.infer<typeof jpPeopleId3RowSchema>>;
export type PeidRow = DeepReadonly<z.infer<typeof peidRowSchema>>;
export type Tier1MergePriorityRow = DeepReadonly<
  z.infer<typeof tier1MergePriorityRowSchema>
>;
export type EngagementMappingRow = DeepReadonly<
  z.infer<typeof engagementMappingRowSchema>
>;
export type PipelineSemanticType = z.infer<typeof pipelineSemanticTypeSchema>;

export type PipelineResourcePayloadByKey = {
  [SOURCE_ALIASES_RESOURCE_KEY]: DeepReadonly<
    z.infer<typeof sourceAliasResourceSchema>
  >;
  [JP_PEOPLE_ID3_RESOURCE_KEY]: DeepReadonly<
    z.infer<typeof jpPeopleId3ResourceSchema>
  >;
  [PEID_RESOURCE_KEY]: DeepReadonly<z.infer<typeof peidResourceSchema>>;
  [TIER1_MERGE_PRIORITIES_RESOURCE_KEY]: DeepReadonly<
    z.infer<typeof tier1MergePrioritiesResourceSchema>
  >;
  [ENGAGEMENT_MAPPINGS_RESOURCE_KEY]: DeepReadonly<
    z.infer<typeof engagementMappingsResourceSchema>
  >;
};

export type PipelineResourcePayload =
  PipelineResourcePayloadByKey[PipelineResourceKey];

export type PipelineResourceEntryByKey = {
  [Key in PipelineResourceKey]: PipelineResourcePayloadByKey[Key]["entries"][number];
};

export type PreparedPipelineResourceEntry<Key extends PipelineResourceKey> =
  DeepReadonly<PipelineResourceEntryByKey[Key] & { stableKey: string }>;

export type PipelineResourceValidationFinding = Readonly<{
  severity: "warning" | "error";
  ruleCode: string;
  message: string;
  stableEntryKey: string | null;
  fieldName: string | null;
  details: Readonly<Record<string, unknown>>;
}>;

export type PipelineResourceValidationContext = Readonly<{
  knownSourceKeys?: ReadonlySet<string>;
  activeSourceKeys?: ReadonlySet<string>;
  knownRop3Codes?: ReadonlySet<string>;
  knownRop1Codes?: ReadonlySet<string>;
  knownIso3Codes?: ReadonlySet<string>;
}>;

export type PreparedPipelineResource<Key extends PipelineResourceKey> = Readonly<{
  resourceKey: Key;
  schemaVersion: typeof PIPELINE_RESOURCE_SCHEMA_VERSION;
  sourceName: string;
  sourceRetrievedAt: string;
  entries: readonly PreparedPipelineResourceEntry<Key>[];
  entryCount: number;
  contentChecksum: string;
  csv: string;
  findings: readonly PipelineResourceValidationFinding[];
  valid: true;
}>;

export type PipelineResourceValidationResult<Key extends PipelineResourceKey> =
  Readonly<{
    valid: boolean;
    resource: PreparedPipelineResource<Key> | null;
    findings: readonly PipelineResourceValidationFinding[];
  }>;

export type PipelineCodeContractKind =
  | "field-contract"
  | "transformation-contract";

export type PipelineCodeContract = Readonly<{
  key: string;
  kind: PipelineCodeContractKind;
  version: string;
  checksum: string;
  definition: DeepReadonly<Record<string, unknown>>;
}>;
