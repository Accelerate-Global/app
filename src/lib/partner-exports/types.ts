import type { CsvColumn } from "@/lib/api-types";

export const PARTNER_EXPORT_PREVIEW_ROW_LIMIT = 25;
export const PARTNER_EXPORT_MAX_ROWS = 100_000;
export const PARTNER_EXPORT_MAX_BYTES = 25 * 1024 * 1024;

export const JOSHUA_PROJECT_HEADERS = [
  "PG_PeopleID3",
  "PG_ROP3",
  "Geo_ROG3",
  "Geo_ISO3",
  "PG_Name_Main",
  "PG_Name_Alt",
  "PG_AX_unique_PG_ID_PGIC",
  "reporting_group",
  "implementing_group",
  "engage_timestamp_of_last_known",
  "engage_status_of_engagement",
  "approx_evangelical_believers",
  "approx_evangelical_churches",
] as const;

export type PartnerExportPartnerKey = "custom" | "joshua-project";
export type PartnerExportProfileStatus = "active" | "archived";
export type PartnerExportRunStatus = "queued" | "running" | "success" | "failed";
export type PartnerExportTransform =
  | "copy"
  | "coalesce"
  | "literal"
  | "whole_number"
  | "iso_timestamp"
  | "non_negative_whole_number";
export type PartnerExportValidationSeverity = "error" | "warning";
export type PartnerExportArtifactKind = "csv" | "crosswalk" | "validation";

export type PartnerExportColumnInput = {
  outputHeader: string;
  sourceColumnKeys: string[];
  sourceLabelSnapshot: string[];
  transform: PartnerExportTransform;
  literalValue: string | null;
  required: boolean;
  requiredSeverity: PartnerExportValidationSeverity;
};

export type PartnerExportProfileInput = {
  name: string;
  partnerKey: PartnerExportPartnerKey;
  fileNameStem: string;
  columns: PartnerExportColumnInput[];
};

export type PartnerExportProfileColumn = PartnerExportColumnInput & {
  id: string;
  ordinal: number;
};

export type PartnerExportProfile = {
  id: string;
  datasetId: string;
  name: string;
  partnerKey: PartnerExportPartnerKey;
  status: PartnerExportProfileStatus;
  fileNameStem: string;
  revision: number;
  columns: PartnerExportProfileColumn[];
  createdByOwnerId: string;
  updatedByOwnerId: string;
  archivedByOwnerId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerExportProfileRevision = {
  id: string;
  datasetId: string;
  name: string;
  partnerKey: PartnerExportPartnerKey;
  fileNameStem: string;
  revision: number;
  columns: PartnerExportProfileColumn[];
};

export type PartnerExportValidationFinding = {
  severity: PartnerExportValidationSeverity;
  code:
    | "required"
    | "required_identifier"
    | "required_geography"
    | "invalid_whole_number"
    | "invalid_non_negative_whole_number"
    | "invalid_iso_timestamp";
  rowIndex: number;
  outputHeader: string;
  message: string;
};

export type PartnerExportValidationSummary = {
  errorCount: number;
  warningCount: number;
  findings: PartnerExportValidationFinding[];
  truncated: boolean;
};

export type PartnerExportCrosswalkEntry = {
  ordinal: number;
  outputHeader: string;
  sourceColumnKeys: string[];
  sourceLabels: string[];
  transform: PartnerExportTransform;
  required: boolean;
  requiredSeverity: PartnerExportValidationSeverity;
};

export type PartnerExportPreview = {
  headers: string[];
  rows: Array<Record<string, string>>;
  sourceRowCount: number;
  previewRowCount: number;
  crosswalk: PartnerExportCrosswalkEntry[];
  validation: PartnerExportValidationSummary;
};

export type PartnerExportSourceSnapshot = {
  datasetId: string;
  blobPath: string;
  currentVersionCreatedAt: string;
  rowCount: number;
  columns: CsvColumn[];
  schemaFingerprint: string;
  contentFingerprint: string;
};

export type PartnerExportRun = {
  id: string;
  profileId: string;
  datasetId: string;
  actorOwnerId: string;
  actorEmail: string | null;
  status: PartnerExportRunStatus;
  warningsAcknowledged: boolean;
  profileRevision: PartnerExportProfileRevision;
  sourceSnapshot: PartnerExportSourceSnapshot;
  validation: PartnerExportValidationSummary;
  rowCount: number | null;
  outputChecksum: string | null;
  outputSizeBytes: number | null;
  csvStoragePath: string | null;
  crosswalkStoragePath: string | null;
  validationStoragePath: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type PartnerExportProfilesResponse = {
  profiles: PartnerExportProfile[];
  runs: PartnerExportRun[];
};

export type PartnerExportProfileResponse = {
  profile: PartnerExportProfile;
};

export type PartnerExportPreviewResponse = {
  preview: PartnerExportPreview;
};

export type PartnerExportRunResponse = {
  run: PartnerExportRun;
};

export class PartnerExportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PartnerExportError";
  }
}
