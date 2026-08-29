import {
  PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
  PRIVATE_DATA_CHAT_CATALOG_VERSION,
  PRIVATE_DATA_CHAT_FIELDS,
  PRIVATE_DATA_CHAT_METRICS,
  PRIVATE_DATA_CHAT_VIEW,
  type PrivateDataChatDimensionKey,
  type PrivateDataChatFilterKey,
  type PrivateDataChatMetricKey,
} from "@/lib/private-data-chat/catalog";
import {
  PRIVATE_DATA_CHAT_MAX_RESULT_BYTES,
  privateDataChatQuerySchema,
  type PrivateDataChatFilter,
  type PrivateDataChatQuery,
} from "@/lib/private-data-chat/schemas";
import type { PrivateDataChatValueBinding } from "@/lib/private-data-chat/value-resolver";

export const PRIVATE_DATA_CHAT_POLICY_VERSION = "query-policy-v2" as const;

export class PrivateDataChatQueryPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateDataChatQueryPolicyError";
  }
}

export type PrivateDataChatSqlParameter =
  | string
  | number
  | boolean
  | null
  | Array<string | number | boolean>;

export type CompiledPrivateDataChatQuery = {
  text: string;
  parameters: PrivateDataChatSqlParameter[];
  selectedKeys: string[];
  catalogVersion: typeof PRIVATE_DATA_CHAT_CATALOG_VERSION;
  catalogChecksum: typeof PRIVATE_DATA_CHAT_CATALOG_CHECKSUM;
  policyVersion: typeof PRIVATE_DATA_CHAT_POLICY_VERSION;
  maxResultBytes: typeof PRIVATE_DATA_CHAT_MAX_RESULT_BYTES;
  query: PrivateDataChatQuery;
  valueBindings: readonly PrivateDataChatValueBinding[];
};

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function fieldExpression(key: PrivateDataChatFilterKey) {
  return `p.${quoteIdentifier(PRIVATE_DATA_CHAT_FIELDS[key].column)}`;
}

function dimensionExpression(key: PrivateDataChatDimensionKey) {
  return fieldExpression(key);
}

function metricExpression(key: PrivateDataChatMetricKey) {
  return PRIVATE_DATA_CHAT_METRICS[key].expression;
}

function compileFilter(
  filter: PrivateDataChatFilter,
  parameters: PrivateDataChatSqlParameter[],
) {
  const field = PRIVATE_DATA_CHAT_FIELDS[filter.field];
  const expression = fieldExpression(filter.field);
  const scalar = Array.isArray(filter.value) ? null : filter.value;

  if (filter.operator === "eq" && scalar === null) {
    return `${expression} IS NULL`;
  }

  if (filter.operator === "neq" && scalar === null) {
    return `${expression} IS NOT NULL`;
  }

  if (filter.operator === "in") {
    if (!Array.isArray(filter.value)) {
      throw new PrivateDataChatQueryPolicyError(
        "The in operator requires an array value.",
      );
    }

    if (filter.value.some((value) => value === null)) {
      throw new PrivateDataChatQueryPolicyError(
        "Null values are not supported inside in filters.",
      );
    }

    parameters.push(
      filter.value as Array<string | number | boolean>,
    );
    const cast =
      field.valueType === "number"
        ? "numeric[]"
        : field.valueType === "boolean"
          ? "boolean[]"
          : "text[]";
    return `${expression} = ANY($${parameters.length}::${cast})`;
  }

  if (scalar === null) {
    throw new PrivateDataChatQueryPolicyError(
      `${filter.operator} does not support a null value.`,
    );
  }

  const operator = {
    eq: "=",
    neq: "<>",
    lt: "<",
    lte: "<=",
    gt: ">",
    gte: ">=",
  }[filter.operator];

  if (!operator) {
    throw new PrivateDataChatQueryPolicyError("Filter operator is not approved.");
  }

  parameters.push(scalar);
  return `${expression} ${operator} $${parameters.length}`;
}

function selectedAggregateKeys(query: Extract<PrivateDataChatQuery, { mode: "aggregate" }>) {
  return [...query.dimensions, ...query.metrics];
}

function validateSort(query: PrivateDataChatQuery, selectedKeys: string[]) {
  const selected = new Set(selectedKeys);

  for (const sort of query.sort) {
    if (!selected.has(sort.field)) {
      throw new PrivateDataChatQueryPolicyError(
        `Sort field ${sort.field} must be selected by the query.`,
      );
    }
  }
}

function compileOrderBy(query: PrivateDataChatQuery, selectedKeys: string[]) {
  validateSort(query, selectedKeys);

  if (query.sort.length > 0) {
    return query.sort
      .map((sort) => `${quoteIdentifier(sort.field)} ${sort.direction.toUpperCase()}`)
      .join(", ");
  }

  if (query.mode === "aggregate") {
    const [firstMetric] = query.metrics;
    const defaults = [
      firstMetric ? `${quoteIdentifier(firstMetric)} DESC` : null,
      ...query.dimensions.map((dimension) => `${quoteIdentifier(dimension)} ASC`),
    ].filter(Boolean);
    return defaults.join(", ");
  }

  const stableKey = query.fields.includes("people_id")
    ? "people_id"
    : query.fields[0];
  return stableKey ? `${quoteIdentifier(stableKey)} ASC` : "";
}

export function compilePrivateDataChatQuery(
  input: unknown,
  options: { valueBindings?: readonly PrivateDataChatValueBinding[] } = {},
): CompiledPrivateDataChatQuery {
  const parsed = privateDataChatQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PrivateDataChatQueryPolicyError(
      "The semantic query does not match the active catalog contract.",
    );
  }
  const query = parsed.data;
  const parameters: PrivateDataChatSqlParameter[] = [];
  const where = query.filters.map((filter) => compileFilter(filter, parameters));
  let selectedKeys: string[];
  let select: string;
  let groupBy = "";

  if (query.mode === "aggregate") {
    for (const metricKey of query.metrics) {
      const metric = PRIVATE_DATA_CHAT_METRICS[metricKey];
      for (const dimension of query.dimensions) {
        if (!metric.compatibleDimensions.includes(dimension)) {
          throw new PrivateDataChatQueryPolicyError(
            `Metric ${metricKey} is not compatible with dimension ${dimension}.`,
          );
        }
      }
    }
    selectedKeys = selectedAggregateKeys(query);
    select = [
      ...query.dimensions.map(
        (dimension) =>
          `${dimensionExpression(dimension)} AS ${quoteIdentifier(dimension)}`,
      ),
      ...query.metrics.map(
        (metric) => `${metricExpression(metric)} AS ${quoteIdentifier(metric)}`,
      ),
    ].join(",\n  ");

    if (query.dimensions.length > 0) {
      groupBy = `\nGROUP BY ${query.dimensions
        .map((dimension) => dimensionExpression(dimension))
        .join(", ")}`;
    }
  } else {
    selectedKeys = [...query.fields];
    select = query.fields
      .map(
        (field) => `${fieldExpression(field)} AS ${quoteIdentifier(field)}`,
      )
      .join(",\n  ");
  }

  const orderBy = compileOrderBy(query, selectedKeys);
  const whereClause = where.length > 0 ? `\nWHERE ${where.join("\n  AND ")}` : "";
  const orderClause = orderBy ? `\nORDER BY ${orderBy}` : "";
  parameters.push(query.limit);

  return {
    text: `SELECT\n  ${select}\nFROM ${PRIVATE_DATA_CHAT_VIEW} AS p${whereClause}${groupBy}${orderClause}\nLIMIT $${parameters.length}`,
    parameters,
    selectedKeys,
    catalogVersion: PRIVATE_DATA_CHAT_CATALOG_VERSION,
    catalogChecksum: PRIVATE_DATA_CHAT_CATALOG_CHECKSUM,
    policyVersion: PRIVATE_DATA_CHAT_POLICY_VERSION,
    maxResultBytes: PRIVATE_DATA_CHAT_MAX_RESULT_BYTES,
    query,
    valueBindings: [...(options.valueBindings ?? [])],
  };
}
