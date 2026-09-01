import {
  PRIVATE_DATA_CHAT_FIELDS,
  PRIVATE_DATA_CHAT_METRICS,
  type PrivateDataChatMetricKey,
  type PrivateDataChatRecordFieldKey,
} from "@/lib/private-data-chat/catalog";
import type {
  PrivateDataChatAnswer,
  PrivateDataChatQueryResult,
} from "@/lib/private-data-chat/schemas";

export type PrivateDataChatEvidenceValue = string | number | boolean | null;

export type PrivateDataChatEvidenceItem = Readonly<{
  id: string;
  kind: "result" | "metric" | "row" | "dataset";
  label: string;
  value: PrivateDataChatEvidenceValue;
  unit: string;
  nullMeaning: string;
  scope: string;
}>;

export type PrivateDataChatEvidenceLedger = Readonly<{
  items: readonly PrivateDataChatEvidenceItem[];
  byId: ReadonlyMap<string, PrivateDataChatEvidenceItem>;
}>;

function conceptMetadata(key: string) {
  if (key in PRIVATE_DATA_CHAT_FIELDS) {
    const field = PRIVATE_DATA_CHAT_FIELDS[key as PrivateDataChatRecordFieldKey];
    return {
      label: field.label,
      unit: field.unit,
      nullMeaning: field.nullMeaning,
      valueType: field.valueType,
    };
  }

  if (key in PRIVATE_DATA_CHAT_METRICS) {
    const metric = PRIVATE_DATA_CHAT_METRICS[key as PrivateDataChatMetricKey];
    return {
      label: metric.label,
      unit: metric.unit,
      nullMeaning: metric.nullMeaning,
      valueType: "number" as const,
    };
  }

  return null;
}

function normalizedEvidenceValue(
  value: unknown,
  valueType: "text" | "number" | "boolean",
): PrivateDataChatEvidenceValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (valueType === "number") {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : String(value);
  }
  if (valueType === "boolean") {
    return typeof value === "boolean" ? value : String(value);
  }
  return String(value);
}

function addEvidence(
  items: PrivateDataChatEvidenceItem[],
  item: PrivateDataChatEvidenceItem,
) {
  if (!items.some((candidate) => candidate.id === item.id)) {
    items.push(item);
  }
}

export function buildPrivateDataChatEvidenceLedger(
  result: PrivateDataChatQueryResult,
): PrivateDataChatEvidenceLedger {
  const items: PrivateDataChatEvidenceItem[] = [];
  const resultScope = `${result.mode}:${result.provenance.dataset}:${
    result.provenance.datasetVersionCreatedAt ?? "unknown-version"
  }`;

  addEvidence(items, {
    id: "result.matching_count",
    kind: "result",
    label: "Matching people-group results",
    value: result.matchingCount,
    unit: result.mode === "records" ? "people groups" : "result rows",
    nullMeaning: "The matching count is always present.",
    scope: resultScope,
  });
  addEvidence(items, {
    id: "result.returned_count",
    kind: "result",
    label: "Returned results",
    value: result.returnedCount,
    unit: "result rows",
    nullMeaning: "The returned count is always present.",
    scope: resultScope,
  });
  addEvidence(items, {
    id: "result.requested_limit",
    kind: "result",
    label: "Requested result limit",
    value: result.requestedLimit,
    unit: "result rows",
    nullMeaning: "The requested limit is always present.",
    scope: resultScope,
  });

  result.rows.forEach((row, rowIndex) => {
    for (const [key, rawValue] of Object.entries(row)) {
      const metadata = conceptMetadata(key);
      if (!metadata) continue;
      const value = normalizedEvidenceValue(rawValue, metadata.valueType);
      addEvidence(items, {
        id: `row.${rowIndex}.${key}`,
        kind: "row",
        label: metadata.label,
        value,
        unit: metadata.unit,
        nullMeaning: metadata.nullMeaning,
        scope: `${resultScope}:row-${rowIndex}`,
      });

      if (
        result.mode === "aggregate" &&
        result.rows.length === 1 &&
        key in PRIVATE_DATA_CHAT_METRICS
      ) {
        addEvidence(items, {
          id: `metric.${key}`,
          kind: "metric",
          label: metadata.label,
          value,
          unit: metadata.unit,
          nullMeaning: metadata.nullMeaning,
          scope: resultScope,
        });
      }
    }
  });

  return {
    items: Object.freeze(items),
    byId: new Map(items.map((item) => [item.id, item])),
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
}

export function formatPrivateDataChatEvidence(item: PrivateDataChatEvidenceItem) {
  if (item.value === null) {
    return `${item.label}: null/missing`;
  }
  const value =
    typeof item.value === "number" ? formatNumber(item.value) : String(item.value);
  const unit = item.unit && !["name", "identifier", "boolean"].includes(item.unit)
    ? ` ${item.unit}`
    : "";
  return `${item.label}: ${value}${unit}`;
}

export function renderPrivateDataChatDeterministicAnswer(input: {
  result: PrivateDataChatQueryResult;
  ledger?: PrivateDataChatEvidenceLedger;
}) {
  const ledger = input.ledger ?? buildPrivateDataChatEvidenceLedger(input.result);
  const result = input.result;
  let answer: string;

  if (result.matchingCount === 0) {
    answer = "No matching records were found in the approved current dataset.";
  } else if (result.mode === "records" && result.hasMore) {
    answer = `${formatNumber(result.matchingCount)} people groups match; showing ${formatNumber(result.returnedCount)}.`;
  } else if (result.mode === "records") {
    answer = `${formatNumber(result.matchingCount)} people groups match.`;
  } else {
    const scalarMetric = ledger.items.find((item) => item.kind === "metric");
    answer = scalarMetric
      ? formatPrivateDataChatEvidence(scalarMetric)
      : result.hasMore
        ? `${formatNumber(result.matchingCount)} grouped results match; showing ${formatNumber(result.returnedCount)}.`
        : `${formatNumber(result.returnedCount)} grouped result ${
            result.returnedCount === 1 ? "row" : "rows"
          } returned.`;
  }

  const facts = result.rows.slice(0, 20).map((row, rowIndex) =>
    Object.keys(row)
      .map((key) => ledger.byId.get(`row.${rowIndex}.${key}`))
      .filter((item): item is PrivateDataChatEvidenceItem => Boolean(item))
      .map(formatPrivateDataChatEvidence)
      .join(", "),
  );

  return { answer, facts };
}

function numericClaims(value: string) {
  return [...value.matchAll(/(?<![A-Za-z])[-+]?\d[\d,]*(?:\.\d+)?/gu)].map(
    (match) => Number(match[0]!.replaceAll(",", "")),
  );
}

export function privateDataChatAnswerUsesOnlyEvidenceNumbers(
  answer: PrivateDataChatAnswer,
  ledger: PrivateDataChatEvidenceLedger,
) {
  const allowed = new Set(
    ledger.items
      .map((item) => item.value)
      .filter((value): value is number => typeof value === "number")
      .map((value) => String(value)),
  );
  const claims = numericClaims([answer.answer, ...answer.facts].join("\n"));
  return claims.every((value) => allowed.has(String(value)));
}

const VISIBLE_PROVENANCE_PATTERN =
  /\b(?:query[ _-]?id|catalog[ _-]?version|dataset[ _-]?version|datasetversioncreatedat)\b|\b20\d{2}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}/iu;

export function privateDataChatAnswerHasVisibleProvenance(
  answer: PrivateDataChatAnswer,
) {
  return VISIBLE_PROVENANCE_PATTERN.test(
    [answer.answer, ...answer.facts].join("\n"),
  );
}

export function renderPrivateDataChatGroundedAnswer(input: {
  result: PrivateDataChatQueryResult;
  modelAnswer?: PrivateDataChatAnswer | null;
}) {
  const ledger = buildPrivateDataChatEvidenceLedger(input.result);
  const deterministic = renderPrivateDataChatDeterministicAnswer({
    result: input.result,
    ledger,
  });

  if (
    !input.modelAnswer ||
    !privateDataChatAnswerUsesOnlyEvidenceNumbers(input.modelAnswer, ledger) ||
    privateDataChatAnswerHasVisibleProvenance(input.modelAnswer)
  ) {
    return { ...deterministic, ledger, usedFallback: true };
  }

  const modelText = input.modelAnswer.answer.trim();
  return {
    answer:
      modelText && modelText !== deterministic.answer
        ? `${deterministic.answer}\n\n${modelText}`
        : deterministic.answer,
    facts: deterministic.facts,
    ledger,
    usedFallback: false,
  };
}
