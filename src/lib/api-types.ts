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

export type DatasetSummary = {
  id: string;
  sortOrder: number;
  fileName: string;
  blobUrl: string;
  blobPath: string;
  status: DatasetStatus;
  rowCount: number;
  sizeBytes: number;
  columns: CsvColumn[];
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
