import { checksumProductValue, normalizeProductText } from "@/lib/tier1-products";

import type { PipelineComparisonReport } from "./types";

function rowKey(row: Readonly<Record<string, string>>) {
  return normalizeProductText(row.PG_AX_unique_PG_ID_PGIC)
    || normalizeProductText(row.PGIC)
    || [normalizeProductText(row.PG_ROP3), normalizeProductText(row.Geo_ISO3)].filter(Boolean).join(":")
    || normalizeProductText(row.Dataset_Row_Key)
    || checksumProductValue(row);
}

function rowsByKey(rows: readonly Readonly<Record<string, string>>[]) {
  return new Map(rows.map((row) => [rowKey(row), row]));
}

export function comparePipelineOutput(input: {
  definitionKey: string;
  currentRows: readonly Readonly<Record<string, string>>[];
  retainedRows: readonly Readonly<Record<string, string>>[];
}): PipelineComparisonReport {
  const current = rowsByKey(input.currentRows);
  const retained = rowsByKey(input.retainedRows);
  const onlyCurrentKeys = [...current.keys()].filter((key) => !retained.has(key)).sort();
  const onlyRetainedKeys = [...retained.keys()].filter((key) => !current.has(key)).sort();
  const changedKeys = [...current.keys()]
    .filter((key) => retained.has(key) && checksumProductValue(current.get(key)) !== checksumProductValue(retained.get(key)))
    .sort();
  const explanations: string[] = [];
  if (onlyCurrentKeys.length > 0) explanations.push(`${onlyCurrentKeys.length} key(s) exist only in the current build.`);
  if (onlyRetainedKeys.length > 0) explanations.push(`${onlyRetainedKeys.length} key(s) exist only in the retained output.`);
  if (changedKeys.length > 0) explanations.push(`${changedKeys.length} shared key(s) have changed values or provenance.`);
  if (explanations.length === 0) explanations.push("Current and retained outputs match by stable key and canonical row content.");
  return {
    schemaVersion: 1,
    definitionKey: input.definitionKey,
    currentChecksum: checksumProductValue(input.currentRows),
    retainedChecksum: checksumProductValue(input.retainedRows),
    currentRowCount: input.currentRows.length,
    retainedRowCount: input.retainedRows.length,
    onlyCurrentKeys,
    onlyRetainedKeys,
    changedKeys,
    explanations,
  };
}
