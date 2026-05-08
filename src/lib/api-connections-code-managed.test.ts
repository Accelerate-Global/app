import { afterEach, describe, expect, it, vi } from "vitest";

const codeManagedImbId = "6f9f6ef2-1188-4f71-9c24-ef01debf7a01";

function createConnectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: codeManagedImbId,
    name: "IMB (People Groups)",
    description: "Materialized description.",
    method: "GET",
    url: "https://services1.arcgis.com/mICk7VdFTP86wcbI/arcgis/rest/services/pIMBpeoplePublic/FeatureServer/0/query",
    requestHeaders: [],
    secretHeaderNames: [],
    secretVaultId: null,
    bodyTemplate: "",
    responseFormat: "json",
    responseDataPath: "features",
    importMode: "create",
    targetDatasetId: null,
    datasetName: "imb-people-groups.csv",
    datasetClassification: "PGIC",
    createdByOwnerId: "admin-1",
    updatedByOwnerId: "admin-1",
    createdAt: new Date("2026-04-30T12:00:00.000Z"),
    updatedAt: new Date("2026-04-30T12:00:00.000Z"),
    ...overrides,
  };
}

function createRunRecord(connectionId = codeManagedImbId) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    connectionId,
    actorOwnerId: "admin-1",
    actorEmail: "admin@example.com",
    mode: "test",
    status: "queued",
    httpStatus: null,
    durationMs: 0,
    rowCount: null,
    datasetId: null,
    errorMessage: null,
    responsePreview: "",
    startedAt: null,
    completedAt: null,
    createdAt: new Date("2026-04-30T12:01:00.000Z"),
  };
}

function createRunLogRecord(runId: string, connectionId: string) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    runId,
    connectionId,
    level: "info",
    message: "Run queued.",
    createdAt: new Date("2026-04-30T12:01:01.000Z"),
  };
}

function createResourceRecord(connectionId = codeManagedImbId) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    connectionId,
    runId: "22222222-2222-4222-8222-222222222222",
    resourceUrl: "https://example.com/resource#details",
    normalizedUrl: "https://example.com/resource",
    webText: "Watch",
    sourceRowIndex: 0,
    sourceResourceIndex: 1,
    createdAt: new Date("2026-04-30T12:02:00.000Z"),
  };
}

async function importApiConnectionsWithDb(db: unknown) {
  vi.resetModules();
  vi.doMock("@/db", () => ({
    getDb: () => db,
  }));

  return import("@/lib/api-connections");
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/db");
});

describe("code-managed API connection listing", () => {
  it("lists built-in connections when the database has no profile rows", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    };
    const { listApiConnections } = await importApiConnectionsWithDb(db);

    const result = await listApiConnections();

    expect(result.connections.map((connection) => connection.name)).toEqual([
      "IMB (People Groups)",
      "Etnopedia",
      "Joshua Project (PGIC)",
    ]);
    expect(result.runs).toEqual([]);
    expect(result.resources).toEqual([]);
  });

  it("uses materialized built-in rows without duplicating them", async () => {
    const materializedImb = createConnectionRow();
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([materializedImb]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
    const db = { select };
    const { listApiConnections } = await importApiConnectionsWithDb(db);

    const result = await listApiConnections();

    expect(result.connections.map((connection) => connection.name)).toEqual([
      "IMB (People Groups)",
      "Etnopedia",
      "Joshua Project (PGIC)",
    ]);
    expect(result.connections[0]?.description).toBe("Materialized description.");
    expect(result.resources).toEqual([]);
  });

  it("returns the newest 500 persisted resources with the connection list", async () => {
    const materializedImb = createConnectionRow();
    const resource = createResourceRecord(materializedImb.id);
    const resourcesLimit = vi.fn().mockResolvedValue([resource]);
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([materializedImb]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: resourcesLimit,
            }),
          }),
        }),
      });
    const db = { select };
    const { listApiConnections } = await importApiConnectionsWithDb(db);

    const result = await listApiConnections();

    expect(resourcesLimit).toHaveBeenCalledWith(500);
    expect(result.resources).toEqual([
      {
        id: resource.id,
        connectionId: materializedImb.id,
        runId: resource.runId,
        resourceUrl: "https://example.com/resource#details",
        normalizedUrl: "https://example.com/resource",
        webText: "Watch",
        sourceRowIndex: 0,
        sourceResourceIndex: 1,
        createdAt: "2026-04-30T12:02:00.000Z",
      },
    ]);
  });
});

describe("code-managed API connection resolver", () => {
  it("returns materialized connection rows first", async () => {
    const materializedImb = createConnectionRow();
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([materializedImb]),
          }),
        }),
      }),
    };
    const { getApiConnection } = await importApiConnectionsWithDb(db);

    const result = await getApiConnection(codeManagedImbId);

    expect(result?.id).toBe(codeManagedImbId);
    expect(result?.description).toBe("Materialized description.");
    expect(result?.updatedAt).toBe("2026-04-30T12:00:00.000Z");
  });

  it("falls back to repo-owned definitions before materialization", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const { getApiConnection } = await importApiConnectionsWithDb(db);

    const result = await getApiConnection(codeManagedImbId);

    expect(result?.id).toBe(codeManagedImbId);
    expect(result?.name).toBe("IMB (People Groups)");
    expect(result?.updatedAt).toBe("2026-04-30T00:00:00.000Z");
  });

  it("returns null for unknown connection IDs", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const { getApiConnection } = await importApiConnectionsWithDb(db);

    await expect(getApiConnection("unknown-connection")).resolves.toBeNull();
  });
});

describe("code-managed API connection materialization", () => {
  it("materializes a built-in connection before queuing its first run", async () => {
    const connectionRow = createConnectionRow();
    const runRecord = createRunRecord(connectionRow.id);
    const runLogRecord = createRunLogRecord(runRecord.id, connectionRow.id);
    const materializeValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([connectionRow]),
      }),
    });
    const runValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([runRecord]),
    });
    const logValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([runLogRecord]),
    });
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([runRecord]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([runLogRecord]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
    const db = {
      select,
      insert: vi
        .fn()
        .mockReturnValueOnce({ values: materializeValues })
        .mockReturnValueOnce({ values: runValues })
        .mockReturnValueOnce({ values: logValues }),
    };
    const { startApiConnectionRun } = await importApiConnectionsWithDb(db);

    const result = await startApiConnectionRun({
      connectionId: codeManagedImbId,
      identity: {
        ownerId: "admin-1",
        email: "admin@example.com",
        fullName: "Admin",
        workspaceRole: "admin",
        isDatasetAdmin: true,
        mode: "supabase",
      },
      importEnabled: false,
    });

    expect(materializeValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: codeManagedImbId,
        name: "IMB (People Groups)",
        createdByOwnerId: "admin-1",
        updatedByOwnerId: "admin-1",
      }),
    );
    expect(runValues).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: codeManagedImbId,
        actorOwnerId: "admin-1",
        mode: "test",
        status: "queued",
      }),
    );
    expect(result?.connection.id).toBe(codeManagedImbId);
    expect(result?.run.logs).toEqual([
      expect.objectContaining({ message: "Run queued." }),
    ]);
  });
});

describe("API connection resource publishing", () => {
  it("publishes resource rows for test and import run outputs", async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const db = {
      insert: vi.fn().mockReturnValue({ values }),
    };
    const { publishApiConnectionResources } = await importApiConnectionsWithDb(db);

    await expect(
      publishApiConnectionResources({
        connectionId: "connection-1",
        runId: "test-run",
        rows: [
          {
            resource_01_category: "Audio",
            resource_01_webtext: "Listen",
            resource_01_url: "https://example.com/audio",
          },
        ],
      }),
    ).resolves.toBe(1);
    await expect(
      publishApiConnectionResources({
        connectionId: "connection-1",
        runId: "import-run",
        rows: [
          {
            resource_01_category: "Film",
            resource_01_webtext: "Watch",
            resource_01_url: "https://example.com/film",
          },
        ],
      }),
    ).resolves.toBe(1);

    expect(values).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        connectionId: "connection-1",
        runId: "test-run",
        normalizedUrl: "https://example.com/audio",
        webText: "Listen",
      }),
    ]);
    expect(values.mock.calls[0]?.[0]?.[0]).not.toHaveProperty("category");
    expect(values).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        connectionId: "connection-1",
        runId: "import-run",
        normalizedUrl: "https://example.com/film",
        webText: "Watch",
      }),
    ]);
    expect(values.mock.calls[1]?.[0]?.[0]).not.toHaveProperty("category");
    expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
  });
});
