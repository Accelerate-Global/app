import { describe, expect, it } from "vitest";

import type { ApiConnection } from "@/lib/api-types";
import { getImbSourceAdapterMetadata } from "@/lib/api-connections/providers/imb";

import { requirePipelineFlowDefinition } from "./registry";
import {
  checksumPipelineSourceExecutionConfig,
  createPipelineSourceExecutionBinding,
  getPipelineSourceAdapterMetadata,
  pipelineSourceCanaryMatchesCurrent,
} from "./source-execution";

function connection(overrides: Partial<ApiConnection> = {}): ApiConnection {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "WCD",
    description: "WCD source",
    method: "GET",
    url: "https://sheets.googleapis.test/source",
    headers: [{ name: "X-Mode", value: "full", isSecret: false }],
    bodyTemplate: "",
    responseFormat: "json",
    responseDataPath: "values",
    importMode: "create",
    targetDatasetId: null,
    datasetName: "wcd.csv",
    datasetClassification: "PGIC",
    provider: "google_sheets",
    providerConfig: {
      provider: "google_sheets",
      spreadsheetId: "sheet-a",
      spreadsheetUrl: "https://docs.google.test/sheet-a",
      spreadsheetTitle: "WCD",
      sheetId: 7,
      sheetTitle: "People Groups",
      rangeMode: "full_tab",
      headerSelection: {
        mode: "manual",
        startRow: 1,
        endRow: 1,
        headers: ["PeopleID3"],
        fingerprint: "header-a",
        confidence: "high",
        confirmedAt: "2026-07-23T00:00:00.000Z",
      },
    },
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
    ...overrides,
  };
}

function tier2ExactInputs(input?: {
  profileContractChecksum?: string;
  resourceChecksum?: string;
}) {
  const profileId = "20000000-0000-4000-8000-000000000001";
  const connectionId = "20000000-0000-4000-8000-000000000002";
  return {
    profileId,
    tier2ProfileBindings: {
      partner: {
        id: profileId,
        connectionId,
        contractChecksum: input?.profileContractChecksum ?? "a".repeat(64),
      },
    },
    tier2ContractBindings: {
      "jp-peopleid3": {
        resourceKey: "jp-peopleid3",
        versionId: "20000000-0000-4000-8000-000000000003",
        checksum: input?.resourceChecksum ?? "b".repeat(64),
        versionNumber: 1,
        schemaVersion: 1,
      },
    },
    sourceExecutionBindings: {
      [`tier2-partner:${profileId}`]: {
        sourceProfileKey: "tier2-partner",
        connectionId,
        checksum: "c".repeat(64),
      },
    },
  };
}

describe("pipeline source execution contracts", () => {
  it("pins the actual IMB replacement adapter checksum into flow semantics", () => {
    const adapter = getImbSourceAdapterMetadata();
    expect(getPipelineSourceAdapterMetadata("imb-people-groups")).toEqual({
      key: adapter.name,
      version: adapter.version,
      checksum: adapter.checksum,
    });
    expect(
      requirePipelineFlowDefinition("source-imb-people-groups").semanticDependencies,
    ).toContainEqual({
      kind: "source-adapter",
      key: adapter.name,
      version: adapter.version,
      checksum: adapter.checksum,
    });
  });

  it("changes the effective checksum for request and immutable Google Sheet tab configuration", () => {
    const original = connection();
    const originalChecksum = checksumPipelineSourceExecutionConfig(original);
    const changes: ApiConnection[] = [
      connection({ method: "POST" }),
      connection({ url: "https://sheets.googleapis.test/replacement" }),
      connection({ headers: [{ name: "X-Mode", value: "delta", isSecret: false }] }),
      connection({ bodyTemplate: "{\"mode\":\"full\"}" }),
      connection({ responseDataPath: "records" }),
      connection({
        providerConfig: {
          ...(original.providerConfig as Extract<ApiConnection["providerConfig"], { provider: "google_sheets" }>),
          sheetId: 8,
        },
      }),
    ];
    for (const changed of changes) {
      expect(checksumPipelineSourceExecutionConfig(changed)).not.toBe(originalChecksum);
    }
  });

  it("keeps renamed Google Sheet display titles outside execution identity", () => {
    const original = connection();
    expect(checksumPipelineSourceExecutionConfig(connection({
      providerConfig: {
        ...(original.providerConfig as Extract<ApiConnection["providerConfig"], { provider: "google_sheets" }>),
        spreadsheetTitle: "Renamed workbook",
        sheetTitle: "Renamed tab",
      },
    }))).toBe(checksumPipelineSourceExecutionConfig(original));
  });

  it("does not treat the mutable publication dataset target as source-request drift", () => {
    const original = connection();
    expect(checksumPipelineSourceExecutionConfig(connection({
      targetDatasetId: "20000000-0000-4000-8000-000000000002",
      importMode: "replace",
    }))).toBe(checksumPipelineSourceExecutionConfig(original));
  });

  it("invalidates a successful source canary after its effective config changes", () => {
    const definition = requirePipelineFlowDefinition("source-wcd-people-groups");
    const oldBinding = createPipelineSourceExecutionBinding({
      sourceProfileKey: "wcd-people-groups",
      connection: connection(),
    });
    const currentBinding = createPipelineSourceExecutionBinding({
      sourceProfileKey: "wcd-people-groups",
      connection: connection({
        providerConfig: {
          ...(connection().providerConfig as Extract<ApiConnection["providerConfig"], { provider: "google_sheets" }>),
          sheetId: 99,
        },
      }),
    });
    const base = {
      connectionIds: { "wcd-people-groups": connection().id },
    };
    expect(pipelineSourceCanaryMatchesCurrent({
      definition,
      canaryExactInputs: {
        ...base,
        sourceExecutionBindings: { "wcd-people-groups": oldBinding },
      },
      currentExactInputs: {
        ...base,
        sourceExecutionBindings: { "wcd-people-groups": currentBinding },
      },
    })).toBe(false);
  });

  it("invalidates a Tier 2 canary after its profile or contract resources change", () => {
    const definition = requirePipelineFlowDefinition("tier2-partner");
    const canaryExactInputs = tier2ExactInputs();
    expect(pipelineSourceCanaryMatchesCurrent({
      definition,
      canaryExactInputs,
      currentExactInputs: tier2ExactInputs(),
    })).toBe(true);
    expect(pipelineSourceCanaryMatchesCurrent({
      definition,
      canaryExactInputs,
      currentExactInputs: tier2ExactInputs({
        profileContractChecksum: "d".repeat(64),
      }),
    })).toBe(false);
    expect(pipelineSourceCanaryMatchesCurrent({
      definition,
      canaryExactInputs,
      currentExactInputs: tier2ExactInputs({
        resourceChecksum: "e".repeat(64),
      }),
    })).toBe(false);
  });

  it("fails closed when a Tier 2 canary predates pinned contract evidence", () => {
    const definition = requirePipelineFlowDefinition("tier2-partner");
    const currentExactInputs = tier2ExactInputs();
    expect(pipelineSourceCanaryMatchesCurrent({
      definition,
      canaryExactInputs: {
        ...currentExactInputs,
        tier2ContractBindings: {},
      },
      currentExactInputs,
    })).toBe(false);
  });
});
