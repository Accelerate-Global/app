import { createHash } from "node:crypto";

import { PRIVATE_DATA_CHAT_UUPG_GUIDANCE } from "@/lib/private-data-chat/semantic-guidance";

export const PRIVATE_DATA_CHAT_NAMED_FILTER_SCHEMA_VERSION = 1 as const;
export const PRIVATE_DATA_CHAT_UUPG_FILTER_KEY = "uupg" as const;
export const PRIVATE_DATA_CHAT_UUPG_FILTER_VERSION = 1 as const;

export type PrivateDataChatNamedFilterField =
  | "globally_engaged"
  | "frontier_group";
export type PrivateDataChatNamedFilterInputValue =
  | boolean
  | null
  | "invalid";

export type PrivateDataChatNamedFilterExpression =
  | Readonly<{
      operator: "and" | "or";
      expressions: readonly PrivateDataChatNamedFilterExpression[];
    }>
  | Readonly<{
      operator: "eq";
      field: PrivateDataChatNamedFilterField;
      value: boolean;
    }>
  | Readonly<{
      operator: "is_missing";
      field: PrivateDataChatNamedFilterField;
    }>;

export type PrivateDataChatUupgOptions = Readonly<{
  globalEngagementAnywhereEnabled: boolean;
  frontierGroupEnabled: boolean;
}>;

export type PrivateDataChatNamedFilterSelection = Readonly<{
  key: typeof PRIVATE_DATA_CHAT_UUPG_FILTER_KEY;
  version: typeof PRIVATE_DATA_CHAT_UUPG_FILTER_VERSION;
  options: PrivateDataChatUupgOptions;
}>;

const UUPG_GLOBAL_ENGAGEMENT_EXPRESSION = Object.freeze({
  operator: "or",
  expressions: Object.freeze([
    Object.freeze({
      operator: "eq",
      field: "globally_engaged",
      value: false,
    }),
    Object.freeze({ operator: "is_missing", field: "globally_engaged" }),
  ]),
} satisfies PrivateDataChatNamedFilterExpression);

const UUPG_FRONTIER_EXPRESSION = Object.freeze({
  operator: "or",
  expressions: Object.freeze([
    Object.freeze({ operator: "eq", field: "frontier_group", value: true }),
    Object.freeze({ operator: "is_missing", field: "frontier_group" }),
  ]),
} satisfies PrivateDataChatNamedFilterExpression);

export function isValidPrivateDataChatUupgOptions(
  options: PrivateDataChatUupgOptions,
) {
  return (
    options.globalEngagementAnywhereEnabled || options.frontierGroupEnabled
  );
}

export function getPrivateDataChatNamedFilterExpression(
  selection: PrivateDataChatNamedFilterSelection,
): PrivateDataChatNamedFilterExpression {
  if (
    selection.key !== PRIVATE_DATA_CHAT_UUPG_FILTER_KEY ||
    selection.version !== PRIVATE_DATA_CHAT_UUPG_FILTER_VERSION ||
    !isValidPrivateDataChatUupgOptions(selection.options)
  ) {
    throw new Error("The named-filter selection is not approved.");
  }

  const expressions: PrivateDataChatNamedFilterExpression[] = [];
  if (selection.options.globalEngagementAnywhereEnabled) {
    expressions.push(UUPG_GLOBAL_ENGAGEMENT_EXPRESSION);
  }
  if (selection.options.frontierGroupEnabled) {
    expressions.push(UUPG_FRONTIER_EXPRESSION);
  }

  return Object.freeze({ operator: "and", expressions: Object.freeze(expressions) });
}

export function evaluatePrivateDataChatNamedFilterExpression(
  expression: PrivateDataChatNamedFilterExpression,
  values: Readonly<
    Record<PrivateDataChatNamedFilterField, PrivateDataChatNamedFilterInputValue>
  >,
): boolean {
  switch (expression.operator) {
    case "and":
      return expression.expressions.every((item) =>
        evaluatePrivateDataChatNamedFilterExpression(item, values),
      );
    case "or":
      return expression.expressions.some((item) =>
        evaluatePrivateDataChatNamedFilterExpression(item, values),
      );
    case "is_missing":
      return values[expression.field] === null;
    case "eq":
      return values[expression.field] === expression.value;
  }
}

export function evaluatePrivateDataChatNamedFilter(
  selection: PrivateDataChatNamedFilterSelection,
  values: Readonly<
    Record<PrivateDataChatNamedFilterField, PrivateDataChatNamedFilterInputValue>
  >,
) {
  return evaluatePrivateDataChatNamedFilterExpression(
    getPrivateDataChatNamedFilterExpression(selection),
    values,
  );
}

export type PrivateDataChatNamedFilterSqlField = Readonly<{
  valueExpression: string;
  missingExpression: string;
}>;

export function compilePrivateDataChatNamedFilterExpression(input: {
  expression: PrivateDataChatNamedFilterExpression;
  fields: Readonly<
    Record<PrivateDataChatNamedFilterField, PrivateDataChatNamedFilterSqlField>
  >;
  parameters: Array<string | number | boolean | null | Array<string | number | boolean>>;
}) {
  const compile = (expression: PrivateDataChatNamedFilterExpression): string => {
    switch (expression.operator) {
      case "and":
      case "or": {
        if (expression.expressions.length === 0) {
          throw new Error("A named-filter boolean expression cannot be empty.");
        }
        const separator = expression.operator === "and" ? " AND " : " OR ";
        return `(${expression.expressions.map(compile).join(separator)})`;
      }
      case "is_missing":
        return `(${input.fields[expression.field].missingExpression})`;
      case "eq":
        input.parameters.push(expression.value);
        return `(${input.fields[expression.field].valueExpression} = $${
          input.parameters.length
        }::boolean)`;
    }
  };

  return compile(input.expression);
}

export const PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY = Object.freeze({
  schemaVersion: PRIVATE_DATA_CHAT_NAMED_FILTER_SCHEMA_VERSION,
  filters: Object.freeze({
    [PRIVATE_DATA_CHAT_UUPG_FILTER_KEY]: Object.freeze({
      key: PRIVATE_DATA_CHAT_UUPG_FILTER_KEY,
      version: PRIVATE_DATA_CHAT_UUPG_FILTER_VERSION,
      label: PRIVATE_DATA_CHAT_UUPG_GUIDANCE.label,
      definition: PRIVATE_DATA_CHAT_UUPG_GUIDANCE.definition,
      nullPreservingRationale:
        PRIVATE_DATA_CHAT_UUPG_GUIDANCE.nullPreservingRationale,
      baselineDistinction: PRIVATE_DATA_CHAT_UUPG_GUIDANCE.baselineDistinction,
      optionKeys: Object.freeze([
        "globalEngagementAnywhereEnabled",
        "frontierGroupEnabled",
      ]),
    }),
  }),
});

export const PRIVATE_DATA_CHAT_NAMED_FILTER_CHECKSUM = createHash("sha256")
  .update(JSON.stringify(PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY))
  .digest("hex");

export const PRIVATE_DATA_CHAT_NAMED_FILTER_REGISTRY_VERSION =
  `named-filters-v1.${PRIVATE_DATA_CHAT_NAMED_FILTER_CHECKSUM.slice(0, 12)}`;
