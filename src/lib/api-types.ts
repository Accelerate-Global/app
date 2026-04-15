export type DatasetStatus = "processing" | "ready" | "failed";

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
  sortOrder: number;
  fileName: string;
  blobUrl: string;
  blobPath: string;
  isPrimary: boolean;
  status: DatasetStatus;
  rowCount: number;
  sizeBytes: number;
  columns: CsvColumn[];
  hiddenColumnKeys: string[];
  tags: DatasetTag[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DatasetRowsResponse = {
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

export type DatasetUploadAuthorizationResponse = {
  mode: "supabase-storage";
  bucket: string;
  path: string;
  token: string;
};

export type FilterRegionsResponse = {
  regions: FilterRegion[];
};

export type FilterRegionResponse = {
  region: FilterRegion;
};

export type FilterRegionCountryOptionsResponse = {
  countries: string[];
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
