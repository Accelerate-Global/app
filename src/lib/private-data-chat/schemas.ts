import { z } from "zod";

import {
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_DATASET_KEY,
  PRIVATE_DATA_CHAT_DIMENSION_KEYS,
  PRIVATE_DATA_CHAT_FILTER_KEYS,
  PRIVATE_DATA_CHAT_METRIC_KEYS,
  PRIVATE_DATA_CHAT_RECORD_FIELD_KEYS,
} from "@/lib/private-data-chat/catalog";

export const PRIVATE_DATA_CHAT_MAX_TURNS = 12;
export const PRIVATE_DATA_CHAT_MAX_MESSAGE_CHARACTERS = 4_000;
export const PRIVATE_DATA_CHAT_MAX_TOTAL_CHARACTERS = 20_000;
export const PRIVATE_DATA_CHAT_MAX_FILTERS = 6;
export const PRIVATE_DATA_CHAT_MAX_DIMENSIONS = 2;
export const PRIVATE_DATA_CHAT_MAX_METRICS = 3;
export const PRIVATE_DATA_CHAT_MAX_FIELDS = 6;
export const PRIVATE_DATA_CHAT_MAX_ROWS = 100;
export const PRIVATE_DATA_CHAT_MAX_RESULT_BYTES = 256_000;

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
    field: z.enum(["people_id", "people_name", "country"]),
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

const privateDataChatQueryBaseSchema = z
  .object({
    catalogVersion: z.literal(PRIVATE_DATA_CHAT_CATALOG_VERSION),
    dataset: z.literal(PRIVATE_DATA_CHAT_DATASET_KEY),
    filters: z
      .array(privateDataChatFilterSchema)
      .max(PRIVATE_DATA_CHAT_MAX_FILTERS)
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
    messages: z
      .array(privateDataChatMessageSchema)
      .min(1)
      .max(PRIVATE_DATA_CHAT_MAX_TURNS),
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
    rows: z.array(z.record(z.string(), z.unknown())).max(PRIVATE_DATA_CHAT_MAX_ROWS),
    provenance: privateDataChatProvenanceSchema,
  })
  .strict();

export const privateDataChatAnswerSchema = z
  .object({
    answer: z.string().min(1).max(4_000),
    facts: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict();

export type PrivateDataChatPlan = z.infer<typeof privateDataChatPlanSchema>;
export type PrivateDataChatQuery = z.infer<typeof privateDataChatQuerySchema>;
export type PrivateDataChatFilter = z.infer<typeof privateDataChatFilterSchema>;
export type PrivateDataChatQueryResult = z.infer<
  typeof privateDataChatQueryResultSchema
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
      fields: ["people_id", "people_name", "country"],
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

const privateDataChatQueryCommonJsonProperties = {
  catalogVersion: {
    type: "string",
    enum: [PRIVATE_DATA_CHAT_CATALOG_VERSION],
  },
  dataset: { type: "string", enum: [PRIVATE_DATA_CHAT_DATASET_KEY] },
  filters: { $ref: "#/$defs/filters" },
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
                "dataset",
                "mode",
                "metrics",
                "dimensions",
                "filters",
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
                "dataset",
                "mode",
                "fields",
                "filters",
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
    sort: privateDataChatSortJsonSchema,
    sorts: {
      type: "array",
      maxItems: 3,
      items: { $ref: "#/$defs/sort" },
    },
  },
} as const;
