import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/db";
import {
  datasetRows,
  datasetVersionRows,
  datasetVersions,
  datasets,
} from "@/db/schema";
import {
  assignDatasetDerivedView,
  createDataset,
  DatasetStoragePathConflictError,
  deleteDataset,
  insertDatasetRowBatch,
  PipelineManagedDatasetMutationError,
  publishPreparedDataset,
  replaceDatasetContents,
  revertDatasetVersion,
  updateDatasetDetails,
  updateDatasetStatus,
} from "@/lib/datasets";
import { syncFieldDefinitionsForColumns } from "@/lib/field-definitions";

vi.mock("@/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/dataset-storage", () => ({
  getDatasetStorageObjectUrl: (path: string) =>
    `https://storage.example.test/datasets/${path}`,
}));

vi.mock("@/lib/field-definitions", () => ({
  syncFieldDefinitionsForColumns: vi.fn(),
}));

const getDbMock = vi.mocked(getDb);
const syncFieldDefinitionsForColumnsMock = vi.mocked(
  syncFieldDefinitionsForColumns,
);

type StoredDataset = typeof datasets.$inferSelect;
type StoredDatasetRow = typeof datasetRows.$inferSelect;
type StoredDatasetVersion = typeof datasetVersions.$inferSelect;
type StoredDatasetVersionRow = typeof datasetVersionRows.$inferSelect;

type FakeState = {
  datasets: StoredDataset[];
  rows: StoredDatasetRow[];
  versions: StoredDatasetVersion[];
  versionRows: StoredDatasetVersionRow[];
};

function createStoredDataset(
  overrides: Partial<StoredDataset> = {},
): StoredDataset {
  const now = new Date("2026-07-22T20:00:00.000Z");

  return {
    id: "dataset-1",
    ownerId: "owner-1",
    backingDatasetId: null,
    fileName: "Current dataset.csv",
    sourceOrganizationName: null,
    sortOrder: 0,
    blobUrl: "https://storage.example.test/datasets/old.csv",
    blobPath: "old.csv",
    currentVersionAction: "upload",
    currentVersionActorOwnerId: "owner-1",
    currentVersionActorEmail: "owner@example.com",
    currentVersionCreatedAt: now,
    isPrimary: false,
    isWorkspaceVisible: true,
    status: "ready",
    rowCount: 1,
    sizeBytes: 12,
    columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
    hiddenColumnKeys: [],
    defaultFilters: null,
    tags: [
      {
        id: "dataset-classification-pgic",
        label: "PGIC",
        color: "#078bc9",
      },
    ],
    error: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createFakeDatabase(
  initialState: FakeState,
  options: {
    failDatasetRowInsert?: boolean;
    pipelinePublicationId?: string;
    transactionError?: unknown;
  } = {},
) {
  const state = {
    current: structuredClone(initialState),
  };

  const database = {
    transaction: async (
      callback: (transaction: ReturnType<typeof createTransaction>) => Promise<unknown>,
    ) => {
      if (options.transactionError) {
        throw options.transactionError;
      }

      const draft = structuredClone(state.current);
      const transaction = createTransaction(draft, options);
      const result = await callback(transaction);
      state.current = draft;
      return result;
    },
  };

  return {
    database,
    state,
  };
}

function createTransaction(
  state: FakeState,
  options: {
    failDatasetRowInsert?: boolean;
    pipelinePublicationId?: string;
    transactionError?: unknown;
  },
) {
  let selectedTarget = false;
  let activeVersionId: string | null = null;

  function createSelectBuilder(table: unknown, selection?: object) {
    let limited = false;
    const builder = {
      where: () => builder,
      limit: () => {
        limited = true;
        selectedTarget = true;
        return builder;
      },
      for: () => builder,
      orderBy: () => builder,
      then: (
        resolve: (value: unknown[]) => unknown,
        reject: (reason: unknown) => unknown,
      ) => {
        try {
          if (table === datasets && selection && "value" in selection) {
            return Promise.resolve([
              {
                value:
                  state.datasets.length === 0
                    ? -1
                    : Math.max(...state.datasets.map((row) => row.sortOrder)),
              },
            ]).then(resolve, reject);
          }

          if (table === datasets && limited) {
            return Promise.resolve(state.datasets.slice(0, 1)).then(
              resolve,
              reject,
            );
          }

          if (table === datasets) {
            return Promise.resolve(
              state.datasets.filter((row) => row.backingDatasetId !== null),
            ).then(resolve, reject);
          }

          return Promise.resolve([]).then(resolve, reject);
        } catch (error) {
          return Promise.reject(error).then(resolve, reject);
        }
      },
    };

    return builder;
  }

  function createInsertBuilder(table: unknown) {
    return {
      values: (rawValues: unknown) => {
        const values = Array.isArray(rawValues) ? rawValues : [rawValues];
        let returningRows: unknown[] = [];

        if (table === datasets) {
          const inserted = createStoredDataset({
            ...(values[0] as Partial<StoredDataset>),
            id: "dataset-created",
            createdAt: new Date("2026-07-22T20:01:00.000Z"),
            updatedAt: new Date("2026-07-22T20:01:00.000Z"),
          });
          state.datasets.push(inserted);
          returningRows = [inserted];
        } else if (table === datasetVersions) {
          const inserted = {
            ...(values[0] as Omit<StoredDatasetVersion, "id" | "archivedAt">),
            id: "version-1",
            archivedAt: new Date("2026-07-22T20:01:00.000Z"),
          } satisfies StoredDatasetVersion;
          state.versions.push(inserted);
          activeVersionId = inserted.id;
          returningRows = [inserted];
        } else if (table === datasetRows) {
          if (options.failDatasetRowInsert) {
            throw new Error("injected dataset row write failure");
          }

          for (const value of values) {
            const row = value as Pick<
              StoredDatasetRow,
              "datasetId" | "rowIndex" | "data"
            >;
            state.rows.push({
              id: `row-${state.rows.length + 1}`,
              datasetId: row.datasetId,
              rowIndex: row.rowIndex,
              data: row.data,
              createdAt: new Date("2026-07-22T20:01:00.000Z"),
            });
          }
        }

        const result = Promise.resolve(undefined);

        return Object.assign(result, {
          returning: async () => returningRows,
        });
      },
    };
  }

  return {
    select: (selection?: object) => ({
      from: (table: unknown) => createSelectBuilder(table, selection),
    }),
    insert: (table: unknown) => createInsertBuilder(table),
    delete: (table: unknown) => ({
      where: async () => {
        if (table === datasetRows && selectedTarget) {
          const targetDatasetId = state.datasets[0]?.id;
          state.rows = state.rows.filter(
            (row) => row.datasetId !== targetDatasetId,
          );
        }
      },
    }),
    update: (table: unknown) => ({
      set: (values: Partial<StoredDataset>) => ({
        where: () => ({
          returning: async () => {
            if (table !== datasets || state.datasets.length === 0) {
              return [];
            }

            state.datasets[0] = {
              ...state.datasets[0],
              ...values,
            };
            return [state.datasets[0]];
          },
        }),
      }),
    }),
    execute: async () => {
      if (!activeVersionId) {
        return options.pipelinePublicationId
          ? [{ id: options.pipelinePublicationId }]
          : [];
      }

      const targetDatasetId = state.datasets[0]?.id;
      for (const row of state.rows.filter(
        (candidate) => candidate.datasetId === targetDatasetId,
      )) {
        state.versionRows.push({
          id: `version-row-${state.versionRows.length + 1}`,
          versionId: activeVersionId,
          rowIndex: row.rowIndex,
          data: row.data,
          createdAt: new Date("2026-07-22T20:01:00.000Z"),
        });
      }
    },
  };
}

function createDeleteDatabase(input: {
  dataset: StoredDataset;
  versionBlobPaths: string[];
  deletableBlobPaths: string[];
}) {
  let datasetSelectCount = 0;
  const execute = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(
      input.deletableBlobPaths.map((blobPath) => ({ blobPath })),
    );

  function createRowsBuilder(rows: unknown[]) {
    const builder = {
      where: () => builder,
      limit: () => builder,
      for: () => builder,
      then: (
        resolve: (value: unknown[]) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(rows).then(resolve, reject),
    };
    return builder;
  }

  const transaction = {
    select: () => ({
      from: (table: unknown) => {
        if (table === datasets) {
          datasetSelectCount += 1;
          return createRowsBuilder(
            datasetSelectCount === 1 ? [input.dataset] : [],
          );
        }
        if (table === datasetVersions) {
          return createRowsBuilder(
            input.versionBlobPaths.map((blobPath) => ({ blobPath })),
          );
        }
        return createRowsBuilder([]);
      },
    }),
    delete: () => ({
      where: async () => undefined,
    }),
    execute,
  };

  return {
    database: {
      transaction: async (
        callback: (tx: typeof transaction) => Promise<unknown>,
      ) => callback(transaction),
    },
    execute,
  };
}

function collectSqlText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(collectSqlText).join(" ");
  }
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  return [record.value, record.queryChunks]
    .map(collectSqlText)
    .filter(Boolean)
    .join(" ");
}

describe("publishPreparedDataset", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    syncFieldDefinitionsForColumnsMock.mockResolvedValue(undefined);
  });

  it("creates a ready dataset only after all prepared rows are stored", async () => {
    const fake = createFakeDatabase({
      datasets: [],
      rows: [],
      versions: [],
      versionRows: [],
    });
    getDbMock.mockReturnValue(fake.database as never);

    const result = await publishPreparedDataset({
      actorOwnerId: "publisher-1",
      actorEmail: "publisher@example.com",
      fileName: "formed.csv",
      blobPath: "formed/new.csv",
      sizeBytes: 42,
      columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
      rows: [{ name: "Alpha" }, { name: "Beta" }],
      classification: "PGIC",
      isWorkspaceVisible: true,
    });

    expect(result).toMatchObject({
      created: true,
      archivedVersionId: null,
      dataset: {
        id: "dataset-created",
        status: "ready",
        rowCount: 2,
        blobPath: "formed/new.csv",
      },
    });
    expect(fake.state.current.rows).toMatchObject([
      { datasetId: "dataset-created", rowIndex: 0, data: { name: "Alpha" } },
      { datasetId: "dataset-created", rowIndex: 1, data: { name: "Beta" } },
    ]);
    expect(fake.state.current.versions).toHaveLength(0);
    expect(syncFieldDefinitionsForColumnsMock).toHaveBeenCalledOnce();
  });

  it("archives the current version and replaces its rows in the same transaction", async () => {
    const existing = createStoredDataset();
    const fake = createFakeDatabase({
      datasets: [existing],
      rows: [
        {
          id: "row-old",
          datasetId: existing.id,
          rowIndex: 0,
          data: { name: "Old" },
          createdAt: existing.createdAt,
        },
      ],
      versions: [],
      versionRows: [],
    });
    getDbMock.mockReturnValue(fake.database as never);

    const result = await publishPreparedDataset({
      targetDatasetId: existing.id,
      actorOwnerId: "publisher-2",
      actorEmail: "publisher-2@example.com",
      fileName: "ignored-for-stable-target.csv",
      blobPath: "formed/replacement.csv",
      sizeBytes: 84,
      columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
      rows: [{ name: "New one" }, { name: "New two" }],
      classification: "PGAC",
      isWorkspaceVisible: true,
    });

    expect(result).toMatchObject({
      created: false,
      archivedVersionId: "version-1",
      dataset: {
        id: existing.id,
        fileName: existing.fileName,
        status: "ready",
        rowCount: 2,
        blobPath: "formed/replacement.csv",
      },
    });
    expect(fake.state.current.versions).toMatchObject([
      {
        id: "version-1",
        datasetId: existing.id,
        blobPath: "old.csv",
        rowCount: 1,
      },
    ]);
    expect(fake.state.current.versionRows).toMatchObject([
      { versionId: "version-1", rowIndex: 0, data: { name: "Old" } },
    ]);
    expect(fake.state.current.rows.map((row) => row.data)).toEqual([
      { name: "New one" },
      { name: "New two" },
    ]);
    expect(fake.state.current.datasets[0]?.tags).toEqual([
      expect.objectContaining({
        label: "PGAC",
        color: "#fcab2a",
      }),
    ]);
  });

  it("rolls back metadata, archive, and row changes when a row write fails", async () => {
    const existing = createStoredDataset();
    const initialState: FakeState = {
      datasets: [existing],
      rows: [
        {
          id: "row-old",
          datasetId: existing.id,
          rowIndex: 0,
          data: { name: "Still current" },
          createdAt: existing.createdAt,
        },
      ],
      versions: [],
      versionRows: [],
    };
    const fake = createFakeDatabase(initialState, {
      failDatasetRowInsert: true,
    });
    getDbMock.mockReturnValue(fake.database as never);

    await expect(
      publishPreparedDataset({
        targetDatasetId: existing.id,
        actorOwnerId: "publisher-3",
        fileName: "failed.csv",
        blobPath: "formed/failed.csv",
        sizeBytes: 84,
        columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
        rows: [{ name: "Must not commit" }],
        classification: "PGIC",
      }),
    ).rejects.toThrow("injected dataset row write failure");

    expect(fake.state.current).toEqual(initialState);
  });

  it("rolls back the dataset when publication finalization fails", async () => {
    const initialState: FakeState = {
      datasets: [],
      rows: [],
      versions: [],
      versionRows: [],
    };
    const fake = createFakeDatabase(initialState);
    getDbMock.mockReturnValue(fake.database as never);

    await expect(
      publishPreparedDataset({
        actorOwnerId: "publisher-4",
        fileName: "formed.csv",
        blobPath: "formed/finalize-failure.csv",
        sizeBytes: 24,
        columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
        rows: [{ name: "Must not commit" }],
        classification: "PGIC",
        finalize: async () => {
          throw new Error("injected publication finalizer failure");
        },
      }),
    ).rejects.toThrow("injected publication finalizer failure");

    expect(fake.state.current).toEqual(initialState);
  });

  it("maps concurrent storage-path ownership conflicts to a stable domain error", async () => {
    const fake = createFakeDatabase(
      {
        datasets: [],
        rows: [],
        versions: [],
        versionRows: [],
      },
      {
        transactionError: {
          code: "23505",
          constraint: "dataset_storage_path_claims_pkey",
        },
      },
    );
    getDbMock.mockReturnValue(fake.database as never);

    await expect(
      createDataset({
        ownerId: "owner-1",
        fileName: "duplicate.csv",
        blobPath: "formed/duplicate.csv",
        sizeBytes: 12,
        columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
        classification: "PGIC",
      }),
    ).rejects.toBeInstanceOf(DatasetStoragePathConflictError);

    await expect(
      replaceDatasetContents({
        datasetId: "dataset-1",
        actorOwnerId: "owner-1",
        blobPath: "formed/duplicate.csv",
        sizeBytes: 12,
        columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
        classification: "PGIC",
      }),
    ).rejects.toBeInstanceOf(DatasetStoragePathConflictError);
  });
});

describe("pipeline-managed dataset mutation guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    syncFieldDefinitionsForColumnsMock.mockResolvedValue(undefined);
  });

  function createPipelineManagedFake() {
    const existing = createStoredDataset();
    const initialState: FakeState = {
      datasets: [existing],
      rows: [
        {
          id: "row-current",
          datasetId: existing.id,
          rowIndex: 0,
          data: { name: "Published" },
          createdAt: existing.createdAt,
        },
      ],
      versions: [],
      versionRows: [],
    };
    const fake = createFakeDatabase(initialState, {
      pipelinePublicationId: "publication-1",
    });
    getDbMock.mockReturnValue(fake.database as never);

    return { existing, fake, initialState };
  }

  it("rejects generic status changes before mutating the published dataset", async () => {
    const { existing, fake, initialState } = createPipelineManagedFake();

    await expect(
      updateDatasetStatus({
        datasetId: existing.id,
        status: "failed",
        error: "manual override",
      }),
    ).rejects.toBeInstanceOf(PipelineManagedDatasetMutationError);

    expect(fake.state.current).toEqual(initialState);
  });

  it("rejects generic workspace-visibility changes before mutating the published dataset", async () => {
    const { existing, fake, initialState } = createPipelineManagedFake();

    await expect(
      updateDatasetDetails({
        datasetId: existing.id,
        isWorkspaceVisible: false,
      }),
    ).rejects.toBeInstanceOf(PipelineManagedDatasetMutationError);

    expect(fake.state.current).toEqual(initialState);
  });

  it("rejects generic classification and tag changes before mutating the published dataset", async () => {
    const { existing, fake, initialState } = createPipelineManagedFake();

    await expect(
      updateDatasetDetails({
        datasetId: existing.id,
        tags: [
          {
            id: "dataset-classification-pgac",
            label: "PGAC",
            color: "#fcab2a",
          },
          {
            id: "manual-tag",
            label: "Manual",
            color: "#8f9f6f",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PipelineManagedDatasetMutationError);

    expect(fake.state.current).toEqual(initialState);
  });

  it("rejects generic deletion before removing published rows or metadata", async () => {
    const { existing, fake, initialState } = createPipelineManagedFake();

    await expect(deleteDataset(existing.id)).rejects.toBeInstanceOf(
      PipelineManagedDatasetMutationError,
    );

    expect(fake.state.current).toEqual(initialState);
  });

  it("still permits non-lineage metadata edits when visibility is unchanged", async () => {
    const { existing, fake } = createPipelineManagedFake();

    const result = await updateDatasetDetails({
      datasetId: existing.id,
      fileName: "Published dataset display name",
      isWorkspaceVisible: true,
    });

    expect(result).toMatchObject({
      id: existing.id,
      fileName: "Published dataset display name",
      isWorkspaceVisible: true,
    });
    expect(fake.state.current.rows).toHaveLength(1);
    expect(fake.state.current.versions).toHaveLength(0);
  });

  it("rejects generic replacement before archiving or deleting published rows", async () => {
    const { existing, fake, initialState } = createPipelineManagedFake();

    await expect(
      replaceDatasetContents({
        datasetId: existing.id,
        actorOwnerId: "operator-1",
        actorEmail: "operator@example.com",
        blobPath: "replacement.csv",
        sizeBytes: 24,
        columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
        classification: "PGIC",
      }),
    ).rejects.toBeInstanceOf(PipelineManagedDatasetMutationError);

    expect(fake.state.current).toEqual(initialState);
  });

  it("rejects generic upload-history revert before archiving or deleting published rows", async () => {
    const { existing, fake, initialState } = createPipelineManagedFake();

    await expect(
      revertDatasetVersion({
        datasetId: existing.id,
        versionId: "version-previous",
        actorOwnerId: "operator-1",
        actorEmail: "operator@example.com",
      }),
    ).rejects.toBeInstanceOf(PipelineManagedDatasetMutationError);

    expect(fake.state.current).toEqual(initialState);
  });

  it("rejects row batch writes before changing published rows or status", async () => {
    const { existing, fake, initialState } = createPipelineManagedFake();

    await expect(
      insertDatasetRowBatch({
        datasetId: existing.id,
        rows: [{ name: "Mutated" }],
        startIndex: 0,
        isFinalBatch: true,
        totalRows: 1,
      }),
    ).rejects.toBeInstanceOf(PipelineManagedDatasetMutationError);

    expect(fake.state.current).toEqual(initialState);
  });

  it("rejects derived-view assignment before archiving or deleting published rows", async () => {
    const { existing, fake, initialState } = createPipelineManagedFake();

    await expect(
      assignDatasetDerivedView({
        datasetId: existing.id,
        sourceDatasetId: "source-dataset-1",
        filters: {
          region: {
            enabled: false,
            selectedRegionIds: [],
            selectedRegionNames: [],
            enabledCountryNames: [],
          },
          country: {
            enabled: false,
            selectedCountryNames: [],
            includeAlternateCountries: false,
          },
          watchlist: {
            enabled: false,
            thresholdEnabled: true,
            threshold: 2,
            engagementPhaseEnabled: true,
            engagementPhaseThreshold: 6,
            jpOnlyEvangelicalCriteriaEnabled: true,
            evangelicalPopulationBelieversRuleEnabled: true,
            evangelicalPopulationBelieversRule: {
              tiers: [{ minPopulation: 0, maxPopulation: null, minBelievers: 50 }],
            },
            frontierGroupEnabled: true,
            frontierGroupValue: true,
          },
          uupg: {
            enabled: false,
            globalEngagementAnywhereEnabled: true,
            frontierGroupEnabled: true,
          },
          hotspots: {
            enabled: false,
            metric: "unique_uupgs",
            countryCount: 10,
          },
          sorting: [],
        },
      }),
    ).rejects.toBeInstanceOf(PipelineManagedDatasetMutationError);

    expect(fake.state.current).toEqual(initialState);
  });
});

describe("dataset storage deletion safety", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns only unreferenced current and historical paths for storage removal", async () => {
    const existing = createStoredDataset({
      blobPath: "datasets/csv/current.csv",
    });
    const fake = createDeleteDatabase({
      dataset: existing,
      versionBlobPaths: [
        "datasets/csv/archive-referenced.csv",
        "datasets/csv/archive-unreferenced.csv",
      ],
      deletableBlobPaths: [
        "datasets/csv/current.csv",
        "datasets/csv/archive-unreferenced.csv",
      ],
    });
    getDbMock.mockReturnValue(fake.database as never);

    const deleted = await deleteDataset(existing.id);

    expect(deleted?.blobPaths).toEqual([
      "datasets/csv/current.csv",
      "datasets/csv/archive-unreferenced.csv",
    ]);
    expect(fake.execute).toHaveBeenCalledTimes(2);
    expect(collectSqlText(fake.execute.mock.calls[1]?.[0])).toContain(
      "from private.dataset_storage_path_claims as claim",
    );
    expect(collectSqlText(fake.execute.mock.calls[1]?.[0])).toContain(
      'claim.dataset_id <>',
    );
  });
});
