export const TIER1_SOURCE_ORDER = ["jp", "imb", "ax", "etno", "wcd"] as const;

export type Tier1SourceKey = (typeof TIER1_SOURCE_ORDER)[number];

export type PipelineProductFinding = Readonly<{
  severity: "warning" | "error";
  ruleCode: string;
  message: string;
  sourceRowKey: string | null;
  fieldName: string | null;
  details: Readonly<Record<string, unknown>>;
}>;

export type Tier1ProductInputRow = Readonly<{
  sourceKey: string;
  sourceLabel?: string;
  stableRowKey: string;
  row: Readonly<Record<string, string>>;
}>;

export type Tier1PriorityRule = Readonly<{
  canonicalField: string;
  prioritySourceKeys: readonly string[];
}>;

export type PipelineProductResult = Readonly<{
  rows: readonly Readonly<Record<string, string>>[];
  findings: readonly PipelineProductFinding[];
  warningCount: number;
  errorCount: number;
  inputRowCount: number;
  outputRowCount: number;
}>;

export type FieldSelection = Readonly<{
  value: string;
  sourceKey: string;
  sourceLabel: string;
  usedFallback: boolean;
  finding: PipelineProductFinding | null;
}>;

export type Aggregate1RuleBinding = Readonly<{
  version: string;
  checksum: string;
}>;

export type SouthAsiaScopeContract = Readonly<{
  version: string;
  checksum: string;
  canonicalCountries: readonly string[];
  aliases: Readonly<Record<string, string>>;
}>;
