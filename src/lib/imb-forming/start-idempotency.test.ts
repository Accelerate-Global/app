import { beforeEach, describe, expect, it, vi } from "vitest";

const lifecycleMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  loadResources: vi.fn(),
  loadLegacyBinding: vi.fn(),
  resolveSourceProfile: vi.fn(),
}));

vi.mock("@/db", () => ({ getDb: lifecycleMocks.getDb }));
vi.mock("@/lib/source-profiles", () => ({
  resolveSourceProfile: lifecycleMocks.resolveSourceProfile,
}));
vi.mock("@/lib/dataset-forming", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/dataset-forming")>();
  return {
    ...actual,
    loadDatasetFormingRuntimeResources: lifecycleMocks.loadResources,
  };
});
vi.mock("./resources", () => ({
  loadImbFormingResourceBinding: lifecycleMocks.loadLegacyBinding,
}));

import {
  claimDatasetFormingRunExecution,
  startImbFormingRun,
} from "./index";
import { createApiConnectionSourceProfileSnapshot } from "@/lib/dataset-forming";

function createSelectChain(result: unknown) {
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(async () => result),
    then(
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

function createUpdateChain(result: unknown) {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(async () => result),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function createInsertRunChain(result: unknown) {
  return {
    values: vi.fn(() => ({
      returning: vi.fn(async () => result),
    })),
  };
}

function createDb(input: {
  selectResults: unknown[];
  transactionSelectResults?: unknown[];
  transactionUpdateResults?: unknown[];
  insertedRun?: unknown[];
  transaction?: ReturnType<typeof vi.fn>;
}) {
  const selectResults = [...input.selectResults];
  const transactionSelectResults = [...(input.transactionSelectResults ?? [])];
  const transactionUpdateResults = [...(input.transactionUpdateResults ?? [])];
  let insertCall = 0;
  const tx = {
    execute: vi.fn(async () => []),
    select: vi.fn(() =>
      createSelectChain(transactionSelectResults.shift() ?? []),
    ),
    update: vi.fn(() =>
      createUpdateChain(transactionUpdateResults.shift() ?? []),
    ),
    insert: vi.fn(() => {
      insertCall += 1;
      return insertCall === 1
        ? createInsertRunChain(input.insertedRun ?? [])
        : { values: vi.fn(async () => undefined) };
    }),
  };
  const transaction =
    input.transaction ?? vi.fn(async (callback) => callback(tx));
  const db = {
    select: vi.fn(() => createSelectChain(selectResults.shift() ?? [])),
    update: vi.fn(),
    transaction,
  };
  lifecycleMocks.getDb.mockReturnValue(db);
  return { db, tx };
}

const resourceBindings = [
  {
    position: 0,
    key: "country-territory-codes",
    bindingType: "catalog" as const,
    required: true,
    kind: "country-geography",
    schemaVersion: 1,
    version: "country-v1",
    checksum: "c".repeat(64),
    resourceSetId: "resource-set-1",
    resourceSetChecksum: "d".repeat(64),
    resourceId: "country-resource",
    resourceVersionId: "country-version",
  },
  {
    position: 1,
    key: "rop-codes",
    bindingType: "catalog" as const,
    required: true,
    kind: "rop-taxonomy",
    schemaVersion: 1,
    version: "rop-v1",
    checksum: "e".repeat(64),
    resourceSetId: "resource-set-1",
    resourceSetChecksum: "d".repeat(64),
    resourceId: "rop-resource",
    resourceVersionId: "rop-version",
  },
  {
    position: 2,
    key: "imb-field-contract",
    bindingType: "code" as const,
    required: true,
    kind: "field-contract",
    schemaVersion: 1,
    version: "1",
    checksum: "f".repeat(64),
    resourceSetId: null,
    resourceSetChecksum: null,
    resourceId: null,
    resourceVersionId: null,
  },
];

function createExistingRun(
  status:
    | "building"
    | "valid"
    | "invalid"
    | "rejected"
    | "publishing"
    | "published"
    | "failed",
  createdAt = new Date(),
) {
  return {
    id: `candidate-${status}`,
    connectionId: "imb",
    sourceRunId: "source-run-1",
    resourceSetId: "resource-set-1",
    sourceProfileKey: "imb-people-groups",
    engineKey: "imb",
    artifactSchemaVersion: 1,
    inputFingerprint: "1".repeat(64),
    attemptNumber: 1,
    publicationTargetKey: "imb-people-groups",
    expectedCurrentPublicationId: null,
    actorOwnerId: "owner-1",
    actorEmail: "admin@example.org",
    status,
    sourceRowsChecksum: "a".repeat(64),
    sourceRawChecksum: "b".repeat(64),
    fieldContractVersion: 1,
    fieldContractChecksum: "f".repeat(64),
    transformationVersion: "imb-forming-v1",
    transformationChecksum: "9".repeat(64),
    inputRowCount: 1,
    outputRowCount: status === "building" ? null : 1,
    warningCount: 0,
    errorCount: 0,
    validationSummary: {
      warningCount: 0,
      errorCount: 0,
      unresolvedCountryRows: 0,
      unresolvedRopRows: 0,
      countryConflictRows: 0,
      ropParentConflictRows: 0,
      invalidValueCount: 0,
      schemaDriftFields: [],
    },
    artifactManifest: {},
    outputChecksum: null,
    outputSizeBytes: null,
    datasetId: null,
    publicationId: null,
    rejectionReason: null,
    rejectedByOwnerId: null,
    rejectedAt: null,
    publicationReason: null,
    warningsAcknowledged: false,
    publishedByOwnerId: null,
    publishedAt: null,
    publishingStartedAt: null,
    errorMessage: null,
    executionClaimedAt: null,
    startedAt: createdAt,
    completedAt: null,
    createdAt,
  };
}

const pinnedSourceProfile = createApiConnectionSourceProfileSnapshot({
  connectionId: "imb",
  sourceProfile: {
    key: "imb-people-groups",
    engineKey: "imb",
    label: "IMB forming",
    stableKeyColumn: null,
    configurable: false,
  },
});

const source = {
  run: {
    status: "success",
    mode: "import",
    sourceProfileSnapshot: pinnedSourceProfile.snapshot,
    sourceProfileChecksum: pinnedSourceProfile.checksum,
  },
  output: {
    rowsChecksum: "a".repeat(64),
    rawChecksum: "b".repeat(64),
    rowCount: 1,
  },
};

async function start(
  overrides: Partial<Parameters<typeof startImbFormingRun>[0]> = {},
) {
  return startImbFormingRun({
    connectionId: "imb",
    sourceRunId: "source-run-1",
    identity: {
      ownerId: "owner-1",
      email: "admin@example.org",
      fullName: "Admin",
      workspaceRole: "super_admin",
      isDatasetAdmin: true,
      mode: "supabase",
    },
    ...overrides,
  });
}

const catalogSnapshot = [
  {
    resourceKey: "country-territory-codes",
    versionId: "country-version",
    checksum: "c".repeat(64),
    versionNumber: 2,
    schemaVersion: 1,
  },
  {
    resourceKey: "rop-codes",
    versionId: "rop-version",
    checksum: "e".repeat(64),
    versionNumber: 3,
    schemaVersion: 1,
  },
];

const exactResourceSnapshot = {
  resourceSetChecksum: "d".repeat(64),
  referenceVersionBindings: Object.fromEntries(
    catalogSnapshot.map((binding) => [
      binding.resourceKey,
      binding,
    ]),
  ),
};

describe("startImbFormingRun idempotency", () => {
  beforeEach(() => {
    lifecycleMocks.getDb.mockReset();
    lifecycleMocks.loadResources.mockReset();
    lifecycleMocks.loadLegacyBinding.mockReset();
    lifecycleMocks.resolveSourceProfile.mockReset();
    lifecycleMocks.loadResources.mockResolvedValue({
      resourceSetId: "resource-set-1",
      resourceSetChecksum: "d".repeat(64),
      resourceBindings,
      countries: [],
      ropEntries: [],
      stableKeyColumn: null,
    });
    lifecycleMocks.loadLegacyBinding.mockResolvedValue({
      resourceSetId: "resource-set-1",
      resourceSetChecksum: "d".repeat(64),
      countryVersionId: "country-version",
      ropVersionId: "rop-version",
    });
  });

  it.each(["building", "valid", "published"] as const)(
    "returns the existing %s result for the same fingerprint",
    async (status) => {
      const existing = createExistingRun(status);
      const { db, tx } = createDb({
        selectResults: [[source], [], []],
        transactionSelectResults: [[existing]],
      });

      await expect(start()).resolves.toMatchObject({
        id: existing.id,
        status,
      });
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(tx.insert).not.toHaveBeenCalled();
    },
  );

  it("marks a stale active build failed and creates a deterministic retry attempt", async () => {
    const stale = createExistingRun(
      "building",
      new Date(Date.now() - 60 * 60 * 1000),
    );
    const failed = {
      ...stale,
      status: "failed" as const,
      errorMessage:
        "The background build did not complete and was superseded.",
      completedAt: new Date(),
    };
    const retry = {
      ...createExistingRun("building"),
      id: "candidate-retry-2",
      attemptNumber: 2,
    };
    const { db } = createDb({
      selectResults: [[source], [], []],
      transactionSelectResults: [[stale]],
      transactionUpdateResults: [[failed]],
      insertedRun: [retry],
    });

    await expect(start()).resolves.toMatchObject({
      id: retry.id,
      status: "building",
      attemptNumber: 2,
    });
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it("creates a new attempt for an identical failed candidate", async () => {
    const failed = createExistingRun("failed");
    const retry = {
      ...createExistingRun("building"),
      id: "candidate-retry-2",
      attemptNumber: 2,
    };
    const { db } = createDb({
      selectResults: [[source], [], []],
      transactionSelectResults: [[failed]],
      insertedRun: [retry],
    });

    await expect(start()).resolves.toMatchObject({
      id: retry.id,
      status: "building",
      attemptNumber: 2,
    });
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["older launch publication", "11111111-1111-4111-8111-111111111111"],
    ["explicitly empty launch publication", null],
  ] as const)(
    "retains the %s pin without consulting a newer publication",
    async (_label, expectedCurrentPublicationId) => {
      const candidate = {
        ...createExistingRun("building"),
        expectedCurrentPublicationId,
      };
      const { tx } = createDb({
        selectResults: [[source], [], []],
        transactionSelectResults: [[]],
        insertedRun: [candidate],
      });
      await expect(
        start({ expectedCurrentPublicationId }),
      ).resolves.toMatchObject({ expectedCurrentPublicationId });
      expect(tx.execute).toHaveBeenCalledTimes(1);
      const runInsert = tx.insert.mock.results[0]?.value;
      expect(runInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({ expectedCurrentPublicationId }),
      );
    },
  );

  it("serializes allocation so concurrent starts retain one exact attempt", async () => {
    let retained: ReturnType<typeof createExistingRun> | null = null;
    const selectResults = [[source], [source], [], [], [], []];
    const db = {
      select: vi.fn(() =>
        createSelectChain(selectResults.shift() ?? []),
      ),
      transaction: vi.fn(async (callback) => {
        const tx = {
          execute: vi.fn(async () => []),
          select: vi.fn(() => createSelectChain(retained ? [retained] : [])),
          update: vi.fn(),
          insert: vi.fn()
            .mockReturnValueOnce({
              values: vi.fn(() => ({
                returning: vi.fn(async () => {
                  retained = createExistingRun("building");
                  return [retained];
                }),
              })),
            })
            .mockReturnValueOnce({ values: vi.fn(async () => undefined) }),
        };
        return callback(tx);
      }),
    };
    lifecycleMocks.getDb.mockReturnValue(db);

    const [first, second] = await Promise.all([start(), start()]);

    expect(first.id).toBe(second.id);
    expect(first.attemptNumber).toBe(1);
    expect(db.transaction).toHaveBeenCalledTimes(2);
  });

  it("allows only one concurrent execution callback to claim a candidate", async () => {
    let claimed = false;
    const update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (claimed) return [];
            claimed = true;
            return [createExistingRun("building")];
          }),
        })),
      })),
    }));
    lifecycleMocks.getDb.mockReturnValue({ update });

    const claims = await Promise.all([
      claimDatasetFormingRunExecution("candidate-building"),
      claimDatasetFormingRunExecution("candidate-building"),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("rejects a forged exact resource-set checksum", async () => {
    const { db } = createDb({
      selectResults: [[source]],
    });

    await expect(
      start({
        resourceSetId: "resource-set-1",
        expectedResourceSnapshot: {
          ...exactResourceSnapshot,
          resourceSetChecksum: "0".repeat(64),
        },
      }),
    ).rejects.toThrow("exact backfill snapshot");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    [
      "missing",
      {
        "country-territory-codes":
          exactResourceSnapshot.referenceVersionBindings[
            "country-territory-codes"
          ],
      },
    ],
    [
      "extra",
      {
        ...exactResourceSnapshot.referenceVersionBindings,
        "unexpected-resource": {
          resourceKey: "unexpected-resource",
          versionId: "unexpected-version",
          checksum: "1".repeat(64),
          versionNumber: 1,
          schemaVersion: 1,
        },
      },
    ],
  ] as const)(
    "rejects an exact resource snapshot with a %s member",
    async (_kind, referenceVersionBindings) => {
      const { db } = createDb({
        selectResults: [[source], catalogSnapshot],
      });

      await expect(
        start({
          resourceSetId: "resource-set-1",
          expectedResourceSnapshot: {
            ...exactResourceSnapshot,
            referenceVersionBindings,
          },
        }),
      ).rejects.toThrow("incomplete or contain unexpected resources");
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );

  it("keeps the requested historical resource set selected when a newer set exists", async () => {
    const candidate = createExistingRun("building");
    const { db } = createDb({
      selectResults: [[source], catalogSnapshot, [], []],
      transactionSelectResults: [[]],
      insertedRun: [candidate],
    });
    lifecycleMocks.loadResources.mockImplementation(async (input) => ({
      resourceSetId:
        input.resourceSetId ?? "newer-resource-set",
      resourceSetChecksum:
        input.resourceSetId === "resource-set-1"
          ? "d".repeat(64)
          : "2".repeat(64),
      resourceBindings,
      countries: [],
      ropEntries: [],
      stableKeyColumn: null,
    }));

    await expect(
      start({
        resourceSetId: "resource-set-1",
        expectedResourceSnapshot: exactResourceSnapshot,
      }),
    ).resolves.toMatchObject({
      id: candidate.id,
      resourceSetId: "resource-set-1",
    });
    expect(lifecycleMocks.loadResources).toHaveBeenCalledWith(
      expect.objectContaining({ resourceSetId: "resource-set-1" }),
    );
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});
