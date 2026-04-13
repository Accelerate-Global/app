export type DatasetStatus = "processing" | "ready" | "failed";

export type CsvColumn = {
  key: string;
  label: string;
  sourceIndex: number;
};

export type DatasetSummary = {
  id: string;
  fileName: string;
  blobUrl: string;
  blobPath: string;
  status: DatasetStatus;
  rowCount: number;
  sizeBytes: number;
  columns: CsvColumn[];
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

export type BlobUploadTokenResponse =
  | {
      mode: "vercel-blob";
      clientToken: string;
      pathname: string;
    }
  | {
      mode: "local-dev";
      clientToken: null;
      pathname: string;
      blobUrl: string;
      warning: string;
    };
