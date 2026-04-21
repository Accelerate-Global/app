"use client";

import type { DatasetRowsResponse } from "@/lib/api-types";

type DatasetRow = DatasetRowsResponse["rows"][number];
type DatasetRowsCacheStatus = "idle" | "loading" | "ready" | "error";
type DatasetRowsCacheListener = (snapshot: DatasetRowsCacheSnapshot) => void;

export type DatasetRowsCacheSnapshot = {
  sourceDatasetId: string;
  rows: DatasetRow[];
  totalRows: number | null;
  status: DatasetRowsCacheStatus;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
};

type DatasetRowsCacheEntry = {
  sourceDatasetId: string;
  rows: DatasetRow[];
  totalRows: number | null;
  status: DatasetRowsCacheStatus;
  error: string | null;
  listeners: Set<DatasetRowsCacheListener>;
  promise: Promise<void> | null;
};

const DATASET_ROWS_PAGE_SIZE = 1000;
const DATASET_ROWS_SINGLE_FETCH_MAX = 20_000;
const datasetRowsCache = new Map<string, DatasetRowsCacheEntry>();

function createEntry(sourceDatasetId: string): DatasetRowsCacheEntry {
  return {
    sourceDatasetId,
    rows: [],
    totalRows: null,
    status: "idle",
    error: null,
    listeners: new Set(),
    promise: null,
  };
}

function getEntry(sourceDatasetId: string) {
  const existingEntry = datasetRowsCache.get(sourceDatasetId);

  if (existingEntry) {
    return existingEntry;
  }

  const nextEntry = createEntry(sourceDatasetId);
  datasetRowsCache.set(sourceDatasetId, nextEntry);
  return nextEntry;
}

function toSnapshot(entry: DatasetRowsCacheEntry): DatasetRowsCacheSnapshot {
  return {
    sourceDatasetId: entry.sourceDatasetId,
    rows: entry.rows,
    totalRows: entry.totalRows,
    status: entry.status,
    isLoading: entry.status === "loading",
    isReady: entry.status === "ready",
    error: entry.error,
  };
}

function notifyListeners(entry: DatasetRowsCacheEntry) {
  const snapshot = toSnapshot(entry);

  for (const listener of entry.listeners) {
    listener(snapshot);
  }
}

async function fetchDatasetRows(input:
  | {
      datasetId: string;
      page: number;
      pageSize: number;
      readAll?: false;
    }
  | {
      datasetId: string;
      readAll: true;
    }) {
  const params = new URLSearchParams();

  if (input.readAll) {
    params.set("all", "true");
  } else {
    params.set("page", String(input.page));
    params.set("pageSize", String(input.pageSize));
  }

  const response = await fetch(`/api/datasets/${input.datasetId}/rows?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Rows could not be loaded.");
  }

  return (await response.json()) as DatasetRowsResponse;
}

async function fetchDatasetRowsPage(input: {
  datasetId: string;
  page: number;
  pageSize: number;
}) {
  return fetchDatasetRows(input);
}

async function fetchAllDatasetRows(input: { datasetId: string }) {
  return fetchDatasetRows({
    datasetId: input.datasetId,
    readAll: true,
  });
}

async function loadDatasetRows(
  entry: DatasetRowsCacheEntry,
  input: {
    datasetId: string;
    pageSize: number;
    expectedRowCount?: number | null;
  },
) {
  entry.rows = [];
  entry.totalRows = null;
  entry.error = null;
  entry.status = "loading";
  notifyListeners(entry);

  const shouldReadAll =
    input.expectedRowCount !== undefined &&
    input.expectedRowCount !== null &&
    input.expectedRowCount <= DATASET_ROWS_SINGLE_FETCH_MAX;

  if (shouldReadAll) {
    const payload = await fetchAllDatasetRows({
      datasetId: input.datasetId,
    });

    if (payload.sourceDatasetId !== entry.sourceDatasetId) {
      throw new Error("The dataset rows source did not match the expected cache key.");
    }

    entry.rows = payload.rows;
    entry.totalRows = payload.totalRows;
    entry.status = "ready";
    entry.error = null;
    notifyListeners(entry);
    return;
  }

  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const payload = await fetchDatasetRowsPage({
      datasetId: input.datasetId,
      page,
      pageSize: input.pageSize,
    });

    if (payload.sourceDatasetId !== entry.sourceDatasetId) {
      throw new Error("The dataset rows source did not match the expected cache key.");
    }

    entry.rows =
      page === 1 ? payload.rows : [...entry.rows, ...payload.rows];
    entry.totalRows = payload.totalRows;
    pageCount = payload.pageCount;
    notifyListeners(entry);
    page += 1;
  }

  entry.status = "ready";
  entry.error = null;
  notifyListeners(entry);
}

export function getDatasetRowsCacheSnapshot(sourceDatasetId: string) {
  const entry = datasetRowsCache.get(sourceDatasetId);

  if (!entry) {
    return {
      sourceDatasetId,
      rows: [],
      totalRows: null,
      status: "idle" as const,
      isLoading: false,
      isReady: false,
      error: null,
    };
  }

  return toSnapshot(entry);
}

export function subscribeToDatasetRowsCache(
  sourceDatasetId: string,
  listener: DatasetRowsCacheListener,
) {
  const entry = getEntry(sourceDatasetId);
  entry.listeners.add(listener);
  listener(toSnapshot(entry));

  return () => {
    entry.listeners.delete(listener);
  };
}

export function ensureDatasetRowsCache(input: {
  datasetId: string;
  sourceDatasetId: string;
  pageSize?: number;
  expectedRowCount?: number | null;
}) {
  const entry = getEntry(input.sourceDatasetId);

  if (entry.status === "ready" || entry.status === "loading") {
    return {
      started: false,
      promise: entry.promise,
    };
  }

  const pageSize = input.pageSize ?? DATASET_ROWS_PAGE_SIZE;
  entry.promise = loadDatasetRows(entry, {
    datasetId: input.datasetId,
    pageSize,
    expectedRowCount: input.expectedRowCount,
  })
    .catch((error) => {
      entry.status = "error";
      entry.error =
        error instanceof Error ? error.message : "Rows could not be loaded.";
      notifyListeners(entry);
      throw error;
    })
    .finally(() => {
      entry.promise = null;
    });

  return {
    started: true,
    promise: entry.promise,
  };
}

export function clearDatasetRowsCache() {
  datasetRowsCache.clear();
}
