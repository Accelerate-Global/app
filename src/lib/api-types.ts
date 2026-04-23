import type { WorkspaceRole } from "@/lib/workspace-role";

export type DatasetStatus = "processing" | "ready" | "failed";
export type DatasetVersionAction = "upload" | "replace" | "revert";

export type CsvColumn = {
  key: string;
  label: string;
  sourceIndex: number;
};

export type DatasetTag = {
  id: string;
  label: string;
  color: string;
};

export type FilterRegion = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  countries: string[];
  createdAt: string;
  updatedAt: string;
};

export type DatasetSummary = {
  id: string;
  backingDatasetId: string | null;
  sortOrder: number;
  fileName: string;
  sourceOrganizationName?: string | null;
  blobUrl: string;
  blobPath: string;
  isPrimary: boolean;
  isPublic: boolean;
  status: DatasetStatus;
  rowCount: number;
  sizeBytes: number;
  columns: CsvColumn[];
  hiddenColumnKeys: string[];
  defaultFilters: SavedDatasetFilterState | null;
  tags: DatasetTag[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DataLakeSource = {
  datasetId: string;
  displayName: string;
  sourceOrganizationName: string | null;
  datasetFileName: string;
  lastUploadAt: string;
  status: DatasetStatus;
  rowCount: number;
  isPublic: boolean;
};

export type DatasetVersionSummary = {
  id: string;
  datasetId: string;
  isCurrent: boolean;
  fileName: string;
  action: DatasetVersionAction;
  actorOwnerId: string;
  actorEmail: string | null;
  status: DatasetStatus;
  rowCount: number;
  sizeBytes: number;
  columnCount: number;
  versionCreatedAt: string;
  archivedAt: string | null;
};

export type DatasetVersionsResponse = {
  versions: DatasetVersionSummary[];
};

export type DatasetRowsResponse = {
  sourceDatasetId: string;
  rows: Array<{
    id: string;
    rowIndex: number;
    data: Record<string, string>;
  }>;
  page: number;
  pageSize: number;
  totalRows: number;
  pageCount: number;
};

export type SavedDatasetSort = {
  id: string;
  desc: boolean;
};

export type PopulationBelieversTier = {
  minPopulation: number;
  maxPopulation: number | null;
  minBelievers: number;
};

export type PopulationBelieversRule = {
  tiers: PopulationBelieversTier[];
};

export type DatasetHotspotsMetric = "unique_uupgs" | "population";

export type SavedDatasetFilterState = {
  region: {
    enabled: boolean;
    selectedRegionIds: string[];
    selectedRegionNames: string[];
    enabledCountryNames: string[];
  };
  country: {
    enabled: boolean;
    selectedCountryNames: string[];
    includeAlternateCountries?: boolean;
  };
  watchlist: {
    enabled: boolean;
    thresholdEnabled?: boolean;
    threshold: number;
    engagementPhaseEnabled?: boolean;
    engagementPhaseThreshold: number;
    evangelicalPopulationBelieversRuleEnabled?: boolean;
    evangelicalPopulationBelieversRule?: PopulationBelieversRule;
    evangelicalBelieversEnabled?: boolean;
    evangelicalBelieversThreshold?: number;
    evangelicalPercentEnabled?: boolean;
    evangelicalPercentThreshold?: number;
    frontierGroupEnabled?: boolean;
    frontierGroupValue?: boolean;
  };
  uupg: {
    enabled: boolean;
  };
  hotspots?: {
    enabled: boolean;
    metric: DatasetHotspotsMetric;
    countryCount: number;
  };
  sorting: SavedDatasetSort[];
};

export type DatasetOpenPreset = Omit<SavedDatasetFilterState, "sorting">;

export type SavedDatasetTable = {
  id: string;
  datasetId: string;
  datasetFileName: string;
  name: string;
  details: string;
  filters: SavedDatasetFilterState;
  savedRowCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SavedDatasetTablesResponse = {
  savedTables: SavedDatasetTable[];
};

export type SavedDatasetTableResponse = {
  savedTable: SavedDatasetTable;
};

export type DatasetUploadAuthorizationResponse = {
  mode: "supabase-storage";
  bucket: string;
  path: string;
  token: string;
};

export type FieldDefinitionLinkedDataset = {
  id: string;
  fileName: string;
};

export type FieldDefinitionLinkedSource = {
  id: string;
  key: string;
  label: string;
};

export type FieldDefinition = {
  id: string;
  canonicalKey: string;
  label: string;
  displayLabel: string;
  definition: string;
  hideFromViewerFieldDefinitions: boolean;
  linkedDatasets: FieldDefinitionLinkedDataset[];
  linkedSources: FieldDefinitionLinkedSource[];
  createdAt: string;
  updatedAt: string;
};

export type FieldDefinitionPresentation = {
  definition: string;
  displayLabel: string;
  effectiveLabel: string;
  linkedSources: FieldDefinitionLinkedSource[];
};

export type FieldSourceType = {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type FieldSourceGridRow = {
  fieldDefinitionId: string;
  canonicalKey: string;
  label: string;
  displayLabel: string;
  effectiveLabel: string;
  definition: string;
  mappingFieldId: string | null;
  mappingDataType: string | null;
  mappingIsActive: boolean | null;
  sourcePriorityKeys: string[];
  sourceValues: Record<string, string>;
  linkedSources: FieldDefinitionLinkedSource[];
  createdAt: string;
  updatedAt: string;
};

export type FieldDefinitionsResponse = {
  fieldDefinitions: FieldDefinition[];
};

export type FieldDefinitionResponse = {
  fieldDefinition: FieldDefinition;
};

export type FieldSourcesResponse = {
  fieldSourceTypes: FieldSourceType[];
  fieldSources: FieldSourceGridRow[];
};

export type FieldSourceResponse = {
  fieldSource: FieldSourceGridRow;
};

export type FieldSourceTypeResponse = {
  fieldSourceType: FieldSourceType;
};

export type WorkspaceUserAccountStatus =
  | "active"
  | "pending_invite"
  | "pending_confirmation"
  | "disabled";

export type WorkspaceUserIdentity = {
  id: string;
  provider: string;
  createdAt: string | null;
  lastLoginAt: string | null;
};

export type WorkspaceUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  workspaceRole: WorkspaceRole;
  accountStatus: WorkspaceUserAccountStatus;
  providers: string[];
  identities: WorkspaceUserIdentity[];
  createdAt: string;
  updatedAt: string | null;
  invitedAt: string | null;
  confirmedAt: string | null;
  emailConfirmedAt: string | null;
  lastLoginAt: string | null;
  bannedUntil: string | null;
};

export type WorkspaceUsersResponse = {
  users: WorkspaceUser[];
};

export type WorkspaceUserResponse = {
  user: WorkspaceUser;
};
