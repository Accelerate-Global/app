import { z } from "zod";

import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_DATASET_KEY,
  PRIVATE_DATA_CHAT_DIMENSION_KEYS,
  PRIVATE_DATA_CHAT_FILTER_KEYS,
  PRIVATE_DATA_CHAT_METRIC_KEYS,
  PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS,
} from "@/lib/private-data-chat/catalog";
import {
  isValidPrivateDataChatUupgOptions,
  PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION,
  PRIVATE_DATA_CHAT_UUPG_FILTER_KEY,
  PRIVATE_DATA_CHAT_UUPG_FILTER_VERSION,
} from "@/lib/private-data-chat/named-filters";
import {
  PRIVATE_DATA_CHAT_ROP_GEOGRAPHY_FILTER,
  PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS,
} from "@/lib/private-data-chat/semantic-authority";

export const PRIVATE_DATA_CHAT_MAX_TURNS = 12;
export const PRIVATE_DATA_CHAT_MAX_MESSAGE_CHARACTERS = 4_000;
export const PRIVATE_DATA_CHAT_MAX_TOTAL_CHARACTERS = 20_000;
export const PRIVATE_DATA_CHAT_MAX_FILTERS = 6;
export const PRIVATE_DATA_CHAT_MAX_NAMED_FILTERS = 2;
export const PRIVATE_DATA_CHAT_MAX_DIMENSIONS = 2;
export const PRIVATE_DATA_CHAT_MAX_METRICS = 3;
export const PRIVATE_DATA_CHAT_MAX_FIELDS = 6;
export const PRIVATE_DATA_CHAT_MAX_ROWS = 100;
export const PRIVATE_DATA_CHAT_MAX_RESULT_BYTES = 256_000;
export const PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS = 25;
export const PRIVATE_DATA_CHAT_RESOURCE_OPERATIONS = [
  "search",
  "list",
  "lookup",
  "count",
  "continue",
] as const;

export const privateDataChatDimensionSchema = z.enum(
  PRIVATE_DATA_CHAT_DIMENSION_KEYS,
);
export const privateDataChatMetricSchema = z.enum(
  PRIVATE_DATA_CHAT_METRIC_KEYS,
);
export const privateDataChatRecordFieldSchema = z.enum(
  PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS,
);
export const privateDataChatFilterFieldSchema = z.enum(
  PRIVATE_DATA_CHAT_FILTER_KEYS,
);

const privateDataChatTextFilterSchema = z
  .object({
    field: z.enum([
      "people_id",
      "people_name",
      "country",
      ...PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS,
      PRIVATE_DATA_CHAT_ROP_GEOGRAPHY_FILTER.key,
    ]),
    operator: z.enum(["eq", "neq", "in"]),
    value: z.union([
      z.string().max(500),
      z.null(),
      z.array(z.string().max(500)).min(1).max(50),
    ]),
  })
  .strict();

const privateDataChatNumberFilterSchema = z
  .object({
    field: z.enum([
      "gsec",
      "engagement_phase",
      "population",
      "percent_evangelical",
    ]),
    operator: z.enum(["eq", "neq", "lt", "lte", "gt", "gte", "in"]),
    value: z.union([
      z.number().finite(),
      z.null(),
      z.array(z.number().finite()).min(1).max(50),
    ]),
  })
  .strict();

const privateDataChatBooleanFilterSchema = z
  .object({
    field: z.enum(["frontier_group", "globally_engaged"]),
    operator: z.enum(["eq", "neq", "in"]),
    value: z.union([
      z.boolean(),
      z.null(),
      z.array(z.boolean()).min(1).max(50),
    ]),
  })
  .strict();

export const privateDataChatFilterSchema = z
  .union([
    privateDataChatTextFilterSchema,
    privateDataChatNumberFilterSchema,
    privateDataChatBooleanFilterSchema,
  ])
  .superRefine((filter, context) => {
    if (filter.operator === "in" && !Array.isArray(filter.value)) {
      context.addIssue({
        code: "custom",
        message: "The in operator requires an array value.",
        path: ["value"],
      });
    }

    if (filter.operator !== "in" && Array.isArray(filter.value)) {
      context.addIssue({
        code: "custom",
        message: `${filter.operator} requires a scalar value.`,
        path: ["value"],
      });
    }
  });

export const privateDataChatSortSchema = z
  .object({
    field: z.enum([
      ...PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS,
      ...PRIVATE_DATA_CHAT_METRIC_KEYS,
    ]),
    direction: z.enum(["asc", "desc"]),
  })
  .strict();

export const privateDataChatNamedFilterSchema = z
  .object({
    key: z.literal(PRIVATE_DATA_CHAT_UUPG_FILTER_KEY),
    version: z.literal(PRIVATE_DATA_CHAT_UUPG_FILTER_VERSION),
    options: z
      .object({
        globalEngagementAnywhereEnabled: z.boolean(),
        frontierGroupEnabled: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((selection, context) => {
    if (!isValidPrivateDataChatUupgOptions(selection.options)) {
      context.addIssue({
        code: "custom",
        message: "At least one UUPG criterion must be enabled.",
        path: ["options"],
      });
    }
  });

const privateDataChatQueryBaseSchema = z
  .object({
    catalogVersion: z.literal(PRIVATE_DATA_CHAT_CATALOG_VERSION),
    namedFilterRegistryVersion: z
      .literal(PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION)
      .default(PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION),
    dataset: z.literal(PRIVATE_DATA_CHAT_DATASET_KEY),
    filters: z
      .array(privateDataChatFilterSchema)
      .max(PRIVATE_DATA_CHAT_MAX_FILTERS)
      .default([]),
    namedFilters: z
      .array(privateDataChatNamedFilterSchema)
      .max(PRIVATE_DATA_CHAT_MAX_NAMED_FILTERS)
      .default([]),
    sort: z.array(privateDataChatSortSchema).max(3).default([]),
    limit: z.number().int().min(1).max(PRIVATE_DATA_CHAT_MAX_ROWS).default(25),
  })
  .strict();

export const privateDataChatAggregateQuerySchema =
  privateDataChatQueryBaseSchema.extend({
    mode: z.literal("aggregate"),
    metrics: z
      .array(privateDataChatMetricSchema)
      .min(1)
      .max(PRIVATE_DATA_CHAT_MAX_METRICS),
    dimensions: z
      .array(privateDataChatDimensionSchema)
      .max(PRIVATE_DATA_CHAT_MAX_DIMENSIONS)
      .default([]),
  });

export const privateDataChatRecordsQuerySchema =
  privateDataChatQueryBaseSchema.extend({
    mode: z.literal("records"),
    fields: z
      .array(privateDataChatRecordFieldSchema)
      .min(1)
      .max(PRIVATE_DATA_CHAT_MAX_FIELDS),
  });

export const privateDataChatQuerySchema = z.discriminatedUnion("mode", [
  privateDataChatAggregateQuerySchema,
  privateDataChatRecordsQuerySchema,
]);

export const privateDataChatResourceQuerySchema = z
  .object({
    resourceKey: z.literal("rop-codes"),
    operation: z.enum(PRIVATE_DATA_CHAT_RESOURCE_OPERATIONS),
    query: z.string().trim().min(1).max(500).nullable().default(null),
    lookupKey: z.string().trim().min(1).max(200).nullable().default(null),
    continuationToken: z.string().min(1).max(12_000).nullable().default(null),
    limit: z
      .number()
      .int()
      .min(1)
      .max(PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS)
      .default(PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS),
  })
  .strict()
  .superRefine((resourceQuery, context) => {
    if (resourceQuery.operation === "search" && !resourceQuery.query) {
      context.addIssue({
        code: "custom",
        message: "ROP search requires a bounded query.",
        path: ["query"],
      });
    }
    if (resourceQuery.operation === "lookup" && !resourceQuery.lookupKey) {
      context.addIssue({
        code: "custom",
        message: "ROP lookup requires an exact code or name.",
        path: ["lookupKey"],
      });
    }
    if (
      resourceQuery.operation === "continue" &&
      !resourceQuery.continuationToken
    ) {
      context.addIssue({
        code: "custom",
        message: "ROP continuation requires server-issued continuation state.",
        path: ["continuationToken"],
      });
    }
    if (
      resourceQuery.operation !== "continue" &&
      resourceQuery.continuationToken
    ) {
      context.addIssue({
        code: "custom",
        message: "Continuation state is valid only for the continue operation.",
        path: ["continuationToken"],
      });
    }
  });

export const privateDataChatPlanSchema = z.discriminatedUnion("decision", [
  z
    .object({
      decision: z.literal("query"),
      query: privateDataChatQuerySchema,
      reason: z.string().min(1).max(500),
    })
    .strict(),
  z
    .object({
      decision: z.literal("resource_query"),
      resourceQuery: privateDataChatResourceQuerySchema,
      reason: z.string().min(1).max(500),
    })
    .strict(),
  z
    .object({
      decision: z.literal("clarify"),
      question: z.string().min(1).max(500),
      reason: z.string().min(1).max(500),
    })
    .strict(),
  z
    .object({
      decision: z.literal("answer"),
      answer: z.string().min(1).max(1_000),
      reason: z.string().min(1).max(500),
    })
    .strict(),
]);

export const privateDataChatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(PRIVATE_DATA_CHAT_MAX_MESSAGE_CHARACTERS),
  })
  .strict();

export const privateDataChatRequestSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    viewContextToken: z.string().min(1).max(12_000).optional(),
    resourceContinuationToken: z.string().min(1).max(12_000).optional(),
    messages: z
      .array(privateDataChatMessageSchema)
      .min(1)
      .max(PRIVATE_DATA_CHAT_MAX_TURNS),
    turnStateTokens: z.array(z.string().min(1).max(12_000)).max(4).default([]),
  })
  .strict()
  .superRefine((request, context) => {
    const totalCharacters = request.messages.reduce(
      (total, message) => total + message.content.length,
      0,
    );

    if (totalCharacters > PRIVATE_DATA_CHAT_MAX_TOTAL_CHARACTERS) {
      context.addIssue({
        code: "custom",
        message: "Conversation context is too large.",
        path: ["messages"],
      });
    }

    if (request.messages.at(-1)?.role !== "user") {
      context.addIssue({
        code: "custom",
        message: "The final conversation turn must be from the user.",
        path: ["messages"],
      });
    }

    if (request.turnStateTokens.length > 0 && !request.conversationId) {
      context.addIssue({
        code: "custom",
        message: "Signed prior-turn state requires a conversation identifier.",
        path: ["conversationId"],
      });
    }
    if (request.resourceContinuationToken && !request.conversationId) {
      context.addIssue({
        code: "custom",
        message: "ROP continuation requires a conversation identifier.",
        path: ["conversationId"],
      });
    }
    if (request.viewContextToken && !request.conversationId) {
      context.addIssue({
        code: "custom",
        message: "Current-view context requires a conversation identifier.",
        path: ["conversationId"],
      });
    }
  });

export const privateDataChatProvenanceSchema = z
  .object({
    queryId: z.string().uuid(),
    catalogVersion: z.string().min(1).max(100),
    dataset: z.literal(PRIVATE_DATA_CHAT_DATASET_KEY),
    datasetId: z.string().uuid().nullable(),
    datasetVersionCreatedAt: z.string().datetime().nullable(),
    rowCount: z.number().int().min(0),
    filters: z.array(
      z.object({
        field: privateDataChatFilterFieldSchema,
        operator: z.string().min(1).max(20),
      }),
    ),
  })
  .strict();

export const privateDataChatQueryResultSchema = z
  .object({
    mode: z.enum(["aggregate", "records"]),
    requestedLimit: z.number().int().min(1).max(PRIVATE_DATA_CHAT_MAX_ROWS),
    returnedCount: z.number().int().min(0).max(PRIVATE_DATA_CHAT_MAX_ROWS),
    matchingCount: z.number().int().min(0),
    hasMore: z.boolean(),
    selectedConcepts: z
      .array(
        z.enum([
          ...PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS,
          ...PRIVATE_DATA_CHAT_METRIC_KEYS,
        ]),
      )
      .max(PRIVATE_DATA_CHAT_MAX_FIELDS + PRIVATE_DATA_CHAT_MAX_METRICS),
    appliedNamedFilters: z
      .array(z.literal(PRIVATE_DATA_CHAT_UUPG_FILTER_KEY))
      .max(PRIVATE_DATA_CHAT_MAX_NAMED_FILTERS),
    rows: z.array(z.record(z.string(), z.unknown())).max(PRIVATE_DATA_CHAT_MAX_ROWS),
    provenance: privateDataChatProvenanceSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.returnedCount !== result.rows.length) {
      context.addIssue({
        code: "custom",
        message: "Returned count must equal the bounded row array length.",
        path: ["returnedCount"],
      });
    }
    if (result.returnedCount > result.requestedLimit) {
      context.addIssue({
        code: "custom",
        message: "Returned count cannot exceed the requested limit.",
        path: ["returnedCount"],
      });
    }
    if (result.matchingCount < result.returnedCount) {
      context.addIssue({
        code: "custom",
        message: "Matching count cannot be smaller than returned count.",
        path: ["matchingCount"],
      });
    }
    if (result.hasMore !== (result.matchingCount > result.returnedCount)) {
      context.addIssue({
        code: "custom",
        message: "Completeness state conflicts with matching/returned counts.",
        path: ["hasMore"],
      });
    }
  });

const privateDataChatRopTermSchema = z
  .object({
    code: z.string().min(1).max(20),
    name: z.string().max(500).nullable(),
    display: z.string().min(1).max(600),
  })
  .strict();

export const privateDataChatRopResourceEntrySchema = z
  .object({
    id: z.string().min(1).max(100),
    rowType: z.enum(["rop3-person", "rop25-parent"]),
    rop1: privateDataChatRopTermSchema.nullable(),
    rop2: privateDataChatRopTermSchema.nullable(),
    rop25: privateDataChatRopTermSchema.nullable(),
    rop3: privateDataChatRopTermSchema.nullable(),
    status: z.enum(["Active", "Inactive"]),
    place: z.string().max(1_000).nullable(),
    language: z.string().max(1_000).nullable(),
    source: z.string().max(1_000).nullable(),
    ethnicId: z.string().max(100).nullable(),
    directRop2: z.string().max(20).nullable(),
    joinIssue: z
      .enum([
        "missing-rop25",
        "missing-rop2",
        "rop2-conflict",
        "parent-only-rop25",
      ])
      .nullable(),
    joinIssueLabel: z.string().max(1_000).nullable(),
    geographyCount: z.number().int().nonnegative().default(0),
    geographies: z
      .array(
        z
          .object({
            geoId: z.number().int(),
            rop3: z.string().min(1).max(20),
            rog: z.string().max(50).nullable(),
            geoName: z.string().max(500).nullable(),
            peopleName: z.string().max(500).nullable(),
            peopleId3: z.string().max(100).nullable(),
            isoAlpha3: z.string().max(10).nullable(),
            status: z.enum(["Active", "Inactive"]),
          })
          .strict(),
      )
      .max(PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS)
      .default([]),
    geographiesTruncated: z.boolean().default(false),
  })
  .strict();

export const privateDataChatResourceQueryResultSchema = z
  .object({
    resourceKey: z.literal("rop-codes"),
    operation: z.enum(PRIVATE_DATA_CHAT_RESOURCE_OPERATIONS),
    normalizedQuery: z.string().max(500).nullable(),
    requestedLimit: z.number().int().min(1).max(PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS),
    pageOffset: z.number().int().min(0),
    returnedCount: z.number().int().min(0).max(PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS),
    matchingCount: z.number().int().min(0),
    hasMore: z.boolean(),
    resourceVersion: z
      .object({
        id: z.string().uuid(),
        versionNumber: z.number().int().positive(),
        contentChecksum: z.string().regex(/^[0-9a-f]{64}$/u),
      })
      .strict(),
    entries: z
      .array(privateDataChatRopResourceEntrySchema)
      .max(PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS),
    ambiguityChoices: z
      .array(privateDataChatRopResourceEntrySchema)
      .max(PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS),
    continuationToken: z.string().min(1).max(12_000).nullable(),
    exportUrl: z.string().startsWith("/api/reference-resources/rop-codes/download"),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.returnedCount !== result.entries.length) {
      context.addIssue({ code: "custom", message: "ROP returned count is inconsistent.", path: ["returnedCount"] });
    }
    if (result.matchingCount < result.returnedCount) {
      context.addIssue({ code: "custom", message: "ROP matching count is inconsistent.", path: ["matchingCount"] });
    }
    if (result.ambiguityChoices.length > 0) {
      if (
        result.entries.length > 0 ||
        result.hasMore ||
        result.continuationToken ||
        result.matchingCount !== result.ambiguityChoices.length
      ) {
        context.addIssue({ code: "custom", message: "ROP ambiguity state is inconsistent.", path: ["ambiguityChoices"] });
      }
      return;
    }
    if (result.operation === "count") {
      if (result.entries.length > 0 || result.hasMore || result.continuationToken) {
        context.addIssue({ code: "custom", message: "ROP count result is inconsistent.", path: ["operation"] });
      }
      return;
    }
    if (
      result.hasMore !==
      (result.pageOffset + result.returnedCount < result.matchingCount)
    ) {
      context.addIssue({ code: "custom", message: "ROP completeness state is inconsistent.", path: ["hasMore"] });
    }
    if (result.hasMore !== Boolean(result.continuationToken)) {
      context.addIssue({ code: "custom", message: "ROP continuation state is inconsistent.", path: ["continuationToken"] });
    }
  });

export const privateDataChatAnswerSchema = z
  .object({
    answer: z.string().min(1).max(4_000),
    facts: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();

export type PrivateDataChatPlan = z.infer<typeof privateDataChatPlanSchema>;
export type PrivateDataChatQuery = z.infer<typeof privateDataChatQuerySchema>;
export type PrivateDataChatResourceQuery = z.infer<
  typeof privateDataChatResourceQuerySchema
>;
export type PrivateDataChatPlanInput = z.input<typeof privateDataChatPlanSchema>;
export type PrivateDataChatQueryInput = z.input<typeof privateDataChatQuerySchema>;
export type PrivateDataChatFilter = z.infer<typeof privateDataChatFilterSchema>;
export type PrivateDataChatNamedFilter = z.infer<
  typeof privateDataChatNamedFilterSchema
>;
export type PrivateDataChatQueryResult = z.infer<
  typeof privateDataChatQueryResultSchema
>;
export type PrivateDataChatResourceQueryResult = z.infer<
  typeof privateDataChatResourceQueryResultSchema
>;
export type PrivateDataChatAnswer = z.infer<typeof privateDataChatAnswerSchema>;

export const PRIVATE_DATA_CHAT_ANSWER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "facts"],
  properties: {
    answer: { type: "string", minLength: 1, maxLength: 4_000 },
    facts: {
      type: "array",
      maxItems: 20,
      items: { type: "string", minLength: 1, maxLength: 500 },
    },
  },
} as const;

function privateDataChatTypedFilterJsonSchema(input: {
  fields: readonly string[];
  operators: readonly string[];
  scalarType: "string" | "number" | "boolean";
}) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["field", "operator", "value"],
    properties: {
      field: { type: "string", enum: input.fields },
      operator: { type: "string", enum: input.operators },
      value: {
        anyOf: [
          { type: [input.scalarType, "null"] },
          {
            type: "array",
            minItems: 1,
            maxItems: 50,
            items: { type: input.scalarType },
          },
        ],
      },
    },
  } as const;
}

const privateDataChatFilterJsonSchema = {
  oneOf: [
    privateDataChatTypedFilterJsonSchema({
      fields: [
        "people_id",
        "people_name",
        "country",
        ...PRIVATE_DATA_CHAT_ROP_QUERYABLE_FIELD_KEYS,
        PRIVATE_DATA_CHAT_ROP_GEOGRAPHY_FILTER.key,
      ],
      operators: ["eq", "neq", "in"],
      scalarType: "string",
    }),
    privateDataChatTypedFilterJsonSchema({
      fields: [
        "gsec",
        "engagement_phase",
        "population",
        "percent_evangelical",
      ],
      operators: ["eq", "neq", "lt", "lte", "gt", "gte", "in"],
      scalarType: "number",
    }),
    privateDataChatTypedFilterJsonSchema({
      fields: ["frontier_group", "globally_engaged"],
      operators: ["eq", "neq", "in"],
      scalarType: "boolean",
    }),
  ],
} as const;

const privateDataChatSortJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["field", "direction"],
  properties: {
    field: {
      type: "string",
      enum: [
        ...PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS,
        ...PRIVATE_DATA_CHAT_METRIC_KEYS,
      ],
    },
    direction: { type: "string", enum: ["asc", "desc"] },
  },
} as const;

const privateDataChatNamedFilterJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "version", "options"],
  properties: {
    key: { type: "string", enum: [PRIVATE_DATA_CHAT_UUPG_FILTER_KEY] },
    version: {
      type: "integer",
      enum: [PRIVATE_DATA_CHAT_UUPG_FILTER_VERSION],
    },
    options: {
      type: "object",
      additionalProperties: false,
      required: [
        "globalEngagementAnywhereEnabled",
        "frontierGroupEnabled",
      ],
      properties: {
        globalEngagementAnywhereEnabled: { type: "boolean" },
        frontierGroupEnabled: { type: "boolean" },
      },
    },
  },
} as const;

const privateDataChatQueryCommonJsonProperties = {
  catalogVersion: {
    type: "string",
    enum: [PRIVATE_DATA_CHAT_CATALOG_VERSION],
  },
  namedFilterRegistryVersion: {
    type: "string",
    enum: [PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION],
  },
  dataset: { type: "string", enum: [PRIVATE_DATA_CHAT_DATASET_KEY] },
  filters: { $ref: "#/$defs/filters" },
  namedFilters: { $ref: "#/$defs/namedFilters" },
  sort: { $ref: "#/$defs/sorts" },
  limit: {
    type: "integer",
    minimum: 1,
    maximum: PRIVATE_DATA_CHAT_MAX_ROWS,
  },
} as const;

export const PRIVATE_DATA_CHAT_PLAN_JSON_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["decision", "query", "reason"],
      properties: {
        decision: { type: "string", enum: ["query"] },
        query: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: [
                "catalogVersion",
                "namedFilterRegistryVersion",
                "dataset",
                "mode",
                "metrics",
                "dimensions",
                "filters",
                "namedFilters",
                "sort",
                "limit",
              ],
              properties: {
                ...privateDataChatQueryCommonJsonProperties,
                mode: { type: "string", enum: ["aggregate"] },
                metrics: {
                  type: "array",
                  minItems: 1,
                  maxItems: PRIVATE_DATA_CHAT_MAX_METRICS,
                  items: {
                    type: "string",
                    enum: PRIVATE_DATA_CHAT_METRIC_KEYS,
                  },
                },
                dimensions: {
                  type: "array",
                  maxItems: PRIVATE_DATA_CHAT_MAX_DIMENSIONS,
                  items: {
                    type: "string",
                    enum: PRIVATE_DATA_CHAT_DIMENSION_KEYS,
                  },
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: [
                "catalogVersion",
                "namedFilterRegistryVersion",
                "dataset",
                "mode",
                "fields",
                "filters",
                "namedFilters",
                "sort",
                "limit",
              ],
              properties: {
                ...privateDataChatQueryCommonJsonProperties,
                mode: { type: "string", enum: ["records"] },
                fields: {
                  type: "array",
                  minItems: 1,
                  maxItems: PRIVATE_DATA_CHAT_MAX_FIELDS,
                  items: {
                    type: "string",
                    enum: PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS,
                  },
                },
              },
            },
          ],
        },
        reason: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["decision", "resourceQuery", "reason"],
      properties: {
        decision: { type: "string", enum: ["resource_query"] },
        resourceQuery: {
          type: "object",
          additionalProperties: false,
          required: [
            "resourceKey",
            "operation",
            "query",
            "lookupKey",
            "continuationToken",
            "limit",
          ],
          properties: {
            resourceKey: { type: "string", enum: ["rop-codes"] },
            operation: {
              type: "string",
              enum: PRIVATE_DATA_CHAT_RESOURCE_OPERATIONS,
            },
            query: {
              anyOf: [
                { type: "string", minLength: 1, maxLength: 500 },
                { type: "null" },
              ],
            },
            lookupKey: {
              anyOf: [
                { type: "string", minLength: 1, maxLength: 200 },
                { type: "null" },
              ],
            },
            continuationToken: {
              anyOf: [
                { type: "string", minLength: 1, maxLength: 12000 },
                { type: "null" },
              ],
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: PRIVATE_DATA_CHAT_MAX_RESOURCE_ROWS,
            },
          },
        },
        reason: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["decision", "question", "reason"],
      properties: {
        decision: { type: "string", enum: ["clarify"] },
        question: { type: "string", minLength: 1, maxLength: 500 },
        reason: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["decision", "answer", "reason"],
      properties: {
        decision: { type: "string", enum: ["answer"] },
        answer: { type: "string", minLength: 1, maxLength: 1_000 },
        reason: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
  ],
  $defs: {
    filter: privateDataChatFilterJsonSchema,
    filters: {
      type: "array",
      maxItems: PRIVATE_DATA_CHAT_MAX_FILTERS,
      items: { $ref: "#/$defs/filter" },
    },
    namedFilter: privateDataChatNamedFilterJsonSchema,
    namedFilters: {
      type: "array",
      maxItems: PRIVATE_DATA_CHAT_MAX_NAMED_FILTERS,
      items: { $ref: "#/$defs/namedFilter" },
    },
    sort: privateDataChatSortJsonSchema,
    sorts: {
      type: "array",
      maxItems: 3,
      items: { $ref: "#/$defs/sort" },
    },
  },
} as const;
