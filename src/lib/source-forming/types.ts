import type { CsvColumn } from "@/lib/api-types";
import type {
  DatasetFormingFinding,
  DatasetFormingResult,
} from "@/lib/dataset-forming/types";

export type SourceSemanticType =
  | "string"
  | "identifier"
  | "integer"
  | "double"
  | "boolean"
  | "datetime";

export type SourceFieldContractEntry = Readonly<{
  sourceField: string | null;
  outputField: string;
  type: SourceSemanticType;
  requiredSourceColumn: boolean;
  requiredMappedValue?: boolean;
}>;

export type SourceProfileKind =
  | "etnopedia"
  | "joshua-project"
  | "wcd"
  | "accelerate";

export type EtnopediaStableIdentityPolicy = Readonly<{
  kind: "etnopedia";
  pageIdFields: readonly string[];
  titleField: string;
}>;

export type JoshuaProjectStableIdentityPolicy = Readonly<{
  kind: "joshua-project";
  providerIdFields: readonly string[];
  peopleId3Field: string;
  iso3Field: string;
}>;

export type ConfiguredStableIdentityPolicy = Readonly<{
  kind: "configured-column";
}>;

export type SourceStableIdentityPolicy =
  | EtnopediaStableIdentityPolicy
  | JoshuaProjectStableIdentityPolicy
  | ConfiguredStableIdentityPolicy;

export type SourceCountryPolicy = Readonly<{
  countryOutputField: string;
  iso3OutputField: string;
  aliasNormalization: "nfkc" | "accent-punctuation-insensitive";
  allowMultiCountryText: boolean;
}>;

export type SourceRopPolicy = Readonly<{
  rop1OutputField: string;
  rop2OutputField: string;
  rop25OutputField: string;
  rop3OutputField: string;
}>;

export type SourceFormingContract = Readonly<{
  schemaVersion: 1;
  key: string;
  profileKind: SourceProfileKind;
  version: string;
  transformationVersion: string;
  dataSourceCode: string;
  fields: readonly SourceFieldContractEntry[];
  knownExcludedSourceFields: readonly string[];
  knownSourceFieldPatterns: readonly string[];
  stableIdentity: SourceStableIdentityPolicy;
  country: SourceCountryPolicy;
  rop: SourceRopPolicy;
}>;

export type SourceCountryReference = Readonly<{
  iso3: string;
  displayName: string;
  alternativeNames: readonly string[];
}>;

export type SourceRopReference = Readonly<{
  rop1Code: string | null;
  rop2Code: string | null;
  rop25Code: string | null;
  rop3Code: string;
  status: "Active" | "Inactive";
  joinIssue: string | null;
  joinIssueLabel: string | null;
}>;

export type SourceJpPeopleId3Reference = Readonly<{
  peopleId3: string;
  rop3: string | null;
  iso3: string | null;
  active: boolean;
  parentStatus: "linked" | "approved-missing";
  missingParentReason: string | null;
}>;

export type SourceFormingResources = Readonly<{
  countries: readonly SourceCountryReference[];
  ropEntries: readonly SourceRopReference[];
  jpPeopleId3Entries?: readonly SourceJpPeopleId3Reference[];
  stableKeyColumn?: string | null;
}>;

export type FormSourceRowsInput = Readonly<{
  sourceProfileKey: string;
  sourceRunId: string;
  columns: readonly CsvColumn[];
  rows: readonly Record<string, string>[];
  resources: SourceFormingResources;
}>;

export type SourceFormingValidationSummary = Readonly<{
  warningCount: number;
  errorCount: number;
  inputRowCount: number;
  outputRowCount: number;
  missingStableKeyRows: number;
  duplicateStableKeyRows: number;
  duplicateDomainKeyRows: number;
  unresolvedCountryRows: number;
  ambiguousCountryRows: number;
  countryConflictRows: number;
  unresolvedRopRows: number;
  ropParentConflictRows: number;
  invalidValueCount: number;
  schemaDriftFields: string[];
}>;

export type SourceFormingResult = DatasetFormingResult<SourceFormingValidationSummary> &
  Readonly<{
    contractKey: string;
    contractVersion: string;
    fieldContractChecksum: string;
    transformationChecksum: string;
  }>;

export type MutableFindingInput = Omit<DatasetFormingFinding, "details"> & {
  details?: Record<string, unknown>;
};

export type FormedRowState = {
  sourceRowIndex: number;
  sourceRow: Record<string, string>;
  row: Record<string, string>;
  stableRowId: string;
  stableRowKey: string;
  countryResolved: boolean;
  ropResolved: boolean;
  findings: DatasetFormingFinding[];
};
