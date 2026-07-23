import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-connections", () => ({
  executeApiConnectionRun: vi.fn(),
  getApiConnection: vi.fn(),
  getApiConnectionRunDetail: vi.fn(),
  listCodeManagedApiConnections: vi.fn(),
  startApiConnectionRun: vi.fn(),
}));
vi.mock("@/lib/source-profiles", () => ({
  resolveSourceProfile: vi.fn(),
}));
vi.mock("@/lib/imb-forming", () => ({
  executeImbFormingRun: vi.fn(),
  publishImbFormingRun: vi.fn(),
  rejectImbFormingRun: vi.fn(),
  startImbFormingRun: vi.fn(),
}));
vi.mock("@/lib/tier2-products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tier2-products")>();
  return {
    ...actual,
    refreshTier2PartnerProfileSheetTitleFromConnection: vi.fn(),
  };
});

import {
  executeApiConnectionRun,
  getApiConnectionRunDetail,
  listCodeManagedApiConnections,
  startApiConnectionRun,
} from "@/lib/api-connections";
import { checksumDatasetFormingValue } from "@/lib/dataset-forming";
import {
  executeImbFormingRun,
  startImbFormingRun,
} from "@/lib/imb-forming";
import { resolveSourceProfile } from "@/lib/source-profiles";
import {
  refreshTier2PartnerProfileSheetTitleFromConnection,
} from "@/lib/tier2-products";

import {
  runSourceFormingStage,
  runSourceIngestionStage,
} from "./handlers";
import { requirePipelineFlowDefinition } from "./registry";
import { createPipelineSourceExecutionBinding } from "./source-execution";

const connectionId = "10000000-0000-4000-8000-000000000001";
const executionConnection = {
  id: connectionId,
  method: "GET" as const,
  url: "https://example.test/imb",
  headers: [],
  bodyTemplate: "",
  responseFormat: "json" as const,
  responseDataPath: "features",
  importMode: "create" as const,
  targetDatasetId: null,
  datasetName: "imb.csv",
  datasetClassification: "PGIC" as const,
  provider: "http_api" as const,
  providerConfig: { provider: "http_api" as const },
};

function context(
  checksum: string,
  options?: {
    definitionKey?: "source-imb-people-groups" | "tier1-full";
    definitionChecksum?: string;
    semanticDependencies?: readonly unknown[];
    stageKey?: string;
  },
) {
  const definition = requirePipelineFlowDefinition(
    options?.definitionKey ?? "source-imb-people-groups",
  );
  return {
    claim: {
      definitionKey: definition.key,
      stageKey: options?.stageKey ?? "imb-ingest",
      flowRunId: "20000000-0000-4000-8000-000000000001",
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.test",
      exactInputs: {
        pipelineDefinition: {
          key: definition.key,
          version: definition.version,
          checksum: options?.definitionChecksum ?? definition.checksum,
          semanticDependencies:
            options?.semanticDependencies ?? definition.semanticDependencies,
        },
        coordinator: { sourceProfileKey: "imb-people-groups" },
        connectionIds: { "imb-people-groups": connectionId },
        sourceProfileBindings: {
          "imb-people-groups": {
            connectionId,
            profileKey: "imb-people-groups",
            engineKey: "imb",
            stableKeyColumn: null,
            configurable: false,
            checksum,
          },
        },
        sourceExecutionBindings: {
          "imb-people-groups": createPipelineSourceExecutionBinding({
            sourceProfileKey: "imb-people-groups",
            connection: executionConnection,
          }),
        },
      },
    },
    reportProgress: vi.fn().mockResolvedValue(undefined),
  } as never;
}

describe("pipeline source ingestion exact bindings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveSourceProfile).mockResolvedValue({
      key: "imb-people-groups",
      engineKey: "imb",
      label: "IMB forming",
      stableKeyColumn: null,
      configurable: false,
    });
    vi.mocked(listCodeManagedApiConnections).mockReturnValue([
      executionConnection,
    ] as never);
  });

  it("fails before ingestion when source-profile configuration no longer matches", async () => {
    await expect(runSourceIngestionStage(context("f".repeat(64))))
      .rejects.toMatchObject({ code: "source-profile-binding-stale" });
    expect(startApiConnectionRun).not.toHaveBeenCalled();
  });

  it("fails before ingestion when the pinned source-engine contract drifts", async () => {
    const stale = context(checksumDatasetFormingValue({
      connectionId,
      profileKey: "imb-people-groups",
      engineKey: "imb",
      stableKeyColumn: null,
      configurable: false,
    }), { definitionChecksum: "f".repeat(64) });

    await expect(runSourceIngestionStage(stale))
      .rejects.toMatchObject({ code: "source-engine-contract-stale" });
    expect(startApiConnectionRun).not.toHaveBeenCalled();
  });

  it("fails before ingestion when the effective request configuration drifts", async () => {
    vi.mocked(listCodeManagedApiConnections).mockReturnValue([{
      ...executionConnection,
      url: "https://example.test/replacement",
    }] as never);
    const binding = {
      connectionId,
      profileKey: "imb-people-groups",
      engineKey: "imb",
      stableKeyColumn: null,
      configurable: false,
    };

    await expect(runSourceIngestionStage(context(
      checksumDatasetFormingValue(binding),
    ))).rejects.toMatchObject({ code: "source-execution-config-stale" });
    expect(startApiConnectionRun).not.toHaveBeenCalled();
  });

  it("uses one deterministic operation key for a matching exact binding", async () => {
    const binding = {
      connectionId,
      profileKey: "imb-people-groups",
      engineKey: "imb",
      stableKeyColumn: null,
      configurable: false,
    };
    vi.mocked(startApiConnectionRun).mockResolvedValue({
      run: { id: "run-1", status: "queued" },
    } as never);
    vi.mocked(executeApiConnectionRun).mockResolvedValue({
      run: {
        id: "run-1",
        status: "success",
        rowCount: 12,
        datasetId: null,
        output: { rowsChecksum: "a".repeat(64) },
      },
    } as never);

    await expect(
      runSourceIngestionStage(
        context(checksumDatasetFormingValue(binding)),
      ),
    ).resolves.toMatchObject({
      outcome: "succeeded",
      rowCount: 12,
      output: {
        apiConnectionRunId: "run-1",
        sourceChecksum: "a".repeat(64),
      },
    });
    expect(startApiConnectionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId,
        operationKey:
          "pipeline:20000000-0000-4000-8000-000000000001:imb-ingest",
      }),
    );
  });

  it("accepts the first Tier 1 source stage with the full product dependency snapshot", async () => {
    const definition = requirePipelineFlowDefinition("tier1-full");
    expect(
      definition.semanticDependencies.some(
        (dependency) => dependency.kind === "product-definition",
      ),
    ).toBe(true);
    const binding = {
      connectionId,
      profileKey: "imb-people-groups",
      engineKey: "imb",
      stableKeyColumn: null,
      configurable: false,
    };
    vi.mocked(startApiConnectionRun).mockResolvedValue({
      run: { id: "run-1", status: "queued" },
    } as never);
    vi.mocked(executeApiConnectionRun).mockResolvedValue({
      run: {
        id: "run-1",
        status: "success",
        rowCount: 12,
        datasetId: null,
        output: { rowsChecksum: "a".repeat(64) },
      },
    } as never);

    await expect(runSourceIngestionStage(context(
      checksumDatasetFormingValue(binding),
      {
        definitionKey: "tier1-full",
        stageKey: "imb-people-groups-ingest",
      },
    ))).resolves.toMatchObject({
      outcome: "succeeded",
      output: { apiConnectionRunId: "run-1" },
    });
  });

  it("refreshes a renamed Tier 2 sheet title after ingesting the same immutable tab", async () => {
    const definition = requirePipelineFlowDefinition("tier2-partner");
    const profileId = "60000000-0000-4000-8000-000000000001";
    const tier2ConnectionId = "60000000-0000-4000-8000-000000000002";
    const tier2Connection = {
      ...executionConnection,
      id: tier2ConnectionId,
      provider: "google_sheets" as const,
      providerConfig: {
        provider: "google_sheets" as const,
        spreadsheetId: "spreadsheet-id",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/spreadsheet-id",
        spreadsheetTitle: "Partner workbook",
        sheetId: 42,
        sheetTitle: "Renamed engagement tab",
        rangeMode: "full_tab" as const,
        headerSelection: {
          mode: "manual" as const,
          startRow: 1,
          endRow: 1,
          headers: ["PeopleID3"],
          fingerprint: "header-fingerprint",
          confidence: "high" as const,
          confirmedAt: "2026-07-23T00:00:00.000Z",
        },
      },
    };
    vi.mocked(listCodeManagedApiConnections).mockReturnValue([
      tier2Connection,
    ] as never);
    vi.mocked(startApiConnectionRun).mockResolvedValue({
      run: { id: "run-tier2", status: "queued" },
    } as never);
    vi.mocked(executeApiConnectionRun).mockResolvedValue({
      run: {
        id: "run-tier2",
        status: "success",
        rowCount: 7,
        datasetId: null,
        output: { rowsChecksum: "d".repeat(64) },
      },
    } as never);
    vi.mocked(refreshTier2PartnerProfileSheetTitleFromConnection)
      .mockResolvedValue({
        sheetTitle: "Renamed engagement tab",
      } as never);
    const tier2Context = {
      claim: {
        definitionKey: definition.key,
        stageKey: "tier2-partner-ingest",
        flowRunId: "60000000-0000-4000-8000-000000000003",
        actorOwnerId: "admin-1",
        actorEmail: "admin@example.test",
        exactInputs: {
          pipelineDefinition: {
            key: definition.key,
            version: definition.version,
            checksum: definition.checksum,
            semanticDependencies: definition.semanticDependencies,
          },
          coordinator: { sourceProfileKey: "tier2-partner" },
          profileId,
          tier2ProfileBindings: {
            partner: {
              id: profileId,
              connectionId: tier2ConnectionId,
              contractChecksum: "e".repeat(64),
            },
          },
          sourceExecutionBindings: {
            [`tier2-partner:${profileId}`]:
              createPipelineSourceExecutionBinding({
                sourceProfileKey: "tier2-partner",
                connection: tier2Connection,
              }),
          },
        },
      },
      reportProgress: vi.fn().mockResolvedValue(undefined),
    };

    await expect(runSourceIngestionStage(tier2Context as never))
      .resolves.toMatchObject({
        outcome: "succeeded",
        rowCount: 7,
        output: {
          apiConnectionRunId: "run-tier2",
          sourceChecksum: "d".repeat(64),
          sheetTitle: "Renamed engagement tab",
        },
      });
    expect(
      refreshTier2PartnerProfileSheetTitleFromConnection,
    ).toHaveBeenCalledWith({
      profileId,
      connectionId: tier2ConnectionId,
    });
  });

  it("rejects actual source semantic drift inside the full Tier 1 snapshot", async () => {
    const definition = requirePipelineFlowDefinition("tier1-full");
    const semanticDependencies = definition.semanticDependencies.map(
      (dependency) =>
        dependency.kind === "source-engine" && dependency.key === "imb"
          ? { ...dependency, checksum: "f".repeat(64) }
          : dependency,
    );
    const binding = {
      connectionId,
      profileKey: "imb-people-groups",
      engineKey: "imb",
      stableKeyColumn: null,
      configurable: false,
    };

    await expect(runSourceIngestionStage(context(
      checksumDatasetFormingValue(binding),
      {
        definitionKey: "tier1-full",
        semanticDependencies,
        stageKey: "imb-people-groups-ingest",
      },
    ))).rejects.toMatchObject({ code: "source-engine-contract-stale" });
    expect(startApiConnectionRun).not.toHaveBeenCalled();
  });

  it("replays the exact archived source run without starting a current ingestion", async () => {
    const binding = {
      connectionId,
      profileKey: "imb-people-groups",
      engineKey: "imb",
      stableKeyColumn: null,
      configurable: false,
    };
    const replay = context(checksumDatasetFormingValue(binding)) as unknown as {
      claim: { exactInputs: Record<string, unknown> };
    };
    replay.claim.exactInputs = {
      ...replay.claim.exactInputs,
      sourceRunId: "30000000-0000-4000-8000-000000000001",
      sourceChecksum: "b".repeat(64),
    };
    vi.mocked(getApiConnectionRunDetail).mockResolvedValue({
      id: "30000000-0000-4000-8000-000000000001",
      connectionId,
      status: "success",
      rowCount: 9,
      datasetId: null,
      output: { rowsChecksum: "b".repeat(64) },
    } as never);

    await expect(runSourceIngestionStage(replay as never)).resolves.toMatchObject({
      outcome: "succeeded",
      rowCount: 9,
      output: {
        apiConnectionRunId: "30000000-0000-4000-8000-000000000001",
        sourceChecksum: "b".repeat(64),
      },
    });
    expect(getApiConnectionRunDetail).toHaveBeenCalledWith({
      connectionId,
      runId: "30000000-0000-4000-8000-000000000001",
    });
    expect(startApiConnectionRun).not.toHaveBeenCalled();
    expect(executeApiConnectionRun).not.toHaveBeenCalled();
  });

  it("rejects a historical source run whose immutable checksum differs from the pin", async () => {
    const binding = {
      connectionId,
      profileKey: "imb-people-groups",
      engineKey: "imb",
      stableKeyColumn: null,
      configurable: false,
    };
    const replay = context(checksumDatasetFormingValue(binding)) as unknown as {
      claim: { exactInputs: Record<string, unknown> };
    };
    replay.claim.exactInputs = {
      ...replay.claim.exactInputs,
      sourceRunId: "30000000-0000-4000-8000-000000000001",
      sourceChecksum: "b".repeat(64),
    };
    vi.mocked(getApiConnectionRunDetail).mockResolvedValue({
      id: "30000000-0000-4000-8000-000000000001",
      connectionId,
      status: "success",
      rowCount: 9,
      datasetId: null,
      output: { rowsChecksum: "c".repeat(64) },
    } as never);

    await expect(runSourceIngestionStage(replay as never)).rejects.toMatchObject({
      code: "historical-source-checksum-mismatch",
      retryable: false,
    });
    expect(startApiConnectionRun).not.toHaveBeenCalled();
  });

  it("uses the idempotent forming lifecycle result without pre-listing or duplicating a candidate", async () => {
    const binding = {
      connectionId,
      profileKey: "imb-people-groups",
      engineKey: "imb",
      stableKeyColumn: null,
      configurable: false,
    };
    const formingContext = context(
      checksumDatasetFormingValue(binding),
    ) as unknown as {
      claim: { exactInputs: Record<string, unknown> };
      reportProgress: ReturnType<typeof vi.fn>;
    };
    formingContext.claim.exactInputs = {
      ...formingContext.claim.exactInputs,
      resourceSetId: "40000000-0000-4000-8000-000000000001",
      resourceSetChecksum: "d".repeat(64),
      formingPublicationIds: {
        "imb-people-groups": "40000000-0000-4000-8000-000000000009",
      },
      referenceVersionBindings: {
        "country-territory-codes": {
          resourceKey: "country-territory-codes",
          versionId: "40000000-0000-4000-8000-000000000002",
          checksum: "e".repeat(64),
          versionNumber: 2,
          schemaVersion: 1,
        },
        "rop-codes": {
          resourceKey: "rop-codes",
          versionId: "40000000-0000-4000-8000-000000000003",
          checksum: "f".repeat(64),
          versionNumber: 3,
          schemaVersion: 1,
        },
        "source-aliases": {
          resourceKey: "source-aliases",
          versionId: "40000000-0000-4000-8000-000000000004",
          checksum: "1".repeat(64),
          versionNumber: 1,
          schemaVersion: 1,
        },
      },
      upstreamOutputs: {
        "imb-people-groups-ingest": {
          sourceProfileKey: "imb-people-groups",
          connectionId,
          apiConnectionRunId: "30000000-0000-4000-8000-000000000001",
          sourceChecksum: "a".repeat(64),
        },
      },
    };
    vi.mocked(startImbFormingRun).mockResolvedValue({
      id: "50000000-0000-4000-8000-000000000001",
      status: "valid",
      outputRowCount: 9,
      outputChecksum: "b".repeat(64),
      resourceSetId: "40000000-0000-4000-8000-000000000001",
      validationSummary: { warningCount: 0, errorCount: 0 },
    } as never);

    await expect(runSourceFormingStage(formingContext as never)).resolves
      .toMatchObject({
        outcome: "succeeded",
        output: {
          formingRunId: "50000000-0000-4000-8000-000000000001",
        },
      });
    expect(startImbFormingRun).toHaveBeenCalledOnce();
    expect(startImbFormingRun).toHaveBeenCalledWith(expect.objectContaining({
      resourceSetId: "40000000-0000-4000-8000-000000000001",
      expectedResourceSnapshot: {
        resourceSetChecksum: "d".repeat(64),
        referenceVersionBindings: formingContext.claim.exactInputs
          .referenceVersionBindings,
      },
      expectedCurrentPublicationId:
        "40000000-0000-4000-8000-000000000009",
    }));
    expect(executeImbFormingRun).not.toHaveBeenCalled();
  });
});
