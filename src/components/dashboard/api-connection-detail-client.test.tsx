// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Table as ReactTable } from "@tanstack/react-table";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiConnectionDetailClient } from "@/components/dashboard/api-connection-detail-client";
import type { ApiConnection, ApiConnectionRun } from "@/lib/api-types";

const { dataGridSpy, pushMock, refreshMock } = vi.hoisted(() => ({
  dataGridSpy: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/components/reui/data-grid/data-grid", async () => {
  const { flexRender } = await import("@tanstack/react-table");

  return {
    DataGrid: (props: {
      table: ReactTable<ApiConnectionRun>;
      onRowClick?: (row: ApiConnectionRun) => void;
      children?: ReactNode;
    }) => {
      dataGridSpy(props);

      return (
        <div>
          {props.children}
          <table data-testid="data-grid">
            <thead>
              {props.table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {props.table.getRowModel().rows.map((row) => (
                <tr key={row.id} onClick={() => props.onRowClick?.(row.original)}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    },
    DataGridContainer: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

vi.mock("@/components/reui/data-grid/data-grid-column-header", () => ({
  DataGridColumnHeader: ({ title }: { title: string }) => <span>{title}</span>,
}));

vi.mock("@/components/reui/data-grid/data-grid-scroll-area", () => ({
  DataGridScrollArea: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div data-testid="data-grid-scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/reui/data-grid/data-grid-table", () => ({
  DataGridTable: () => null,
}));

const connection: ApiConnection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "People API",
  description: "Imports people data.",
  method: "GET",
  url: "https://api.example.com/people",
  headers: [],
  bodyTemplate: "",
  responseFormat: "json",
  responseDataPath: "data",
  importMode: "create",
  targetDatasetId: null,
  datasetName: "people.csv",
  datasetClassification: "PGAC",
  createdAt: "2026-04-24T12:00:00.000Z",
  updatedAt: "2026-04-24T12:00:00.000Z",
};

const serviceAccountEmail = "sheets@app-project.iam.gserviceaccount.com";

const googleSheetsConnection: ApiConnection = {
  ...connection,
  id: "99999999-9999-4999-8999-999999999999",
  name: "Mission Sheet - Alpha",
  description: "Google Sheets tab import.",
  provider: "google_sheets",
  providerConfig: {
    provider: "google_sheets",
    spreadsheetId: "sheet_123",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    spreadsheetTitle: "Mission Sheet",
    sheetId: 1,
    sheetTitle: "Alpha",
    rangeMode: "full_tab",
    headerSelection: {
      mode: "auto",
      startRow: 1,
      endRow: 1,
      headers: ["Record ID", "Tracking ID", "ROP3", "Country"],
      fingerprint: "header-fingerprint",
      confidence: "high",
      confirmedAt: "2026-04-24T12:00:00.000Z",
    },
  },
  importMode: "replace",
  targetDatasetId: "dataset-1",
};

const successfulRun: ApiConnectionRun = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: connection.id,
  sourceProfileSnapshot: null,
  sourceProfileChecksum: null,
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  mode: "test",
  status: "success",
  httpStatus: 200,
  durationMs: 33,
  rowCount: 2,
  datasetId: "dataset-1",
  errorMessage: null,
  responsePreview: "[{\"name\":\"Alpha\"}]",
  startedAt: "2026-04-24T12:00:01.000Z",
  completedAt: "2026-04-24T12:00:02.000Z",
  createdAt: "2026-04-24T12:00:00.000Z",
  logs: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      runId: "22222222-2222-4222-8222-222222222222",
      connectionId: connection.id,
      level: "info",
      message: "Archived output artifacts.",
      createdAt: "2026-04-24T12:00:02.000Z",
    },
  ],
  output: {
    id: "55555555-5555-4555-8555-555555555555",
    runId: "22222222-2222-4222-8222-222222222222",
    connectionId: connection.id,
    rowCount: 2,
    columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
    rowsStoragePath: "api-connection-runs/run/rows.json",
    rawStoragePath: "api-connection-runs/run/raw-response.json",
    rowsSizeBytes: 20,
    rawSizeBytes: 24,
    rowsChecksum: null,
    rawChecksum: null,
    createdAt: "2026-04-24T12:00:02.000Z",
  },
};

function createHistoryRun(index: number): ApiConnectionRun {
  const runId = `history-run-${index}`;
  const createdAt = new Date(
    Date.parse(successfulRun.createdAt) + index * 60_000,
  ).toISOString();
  const startedAt = new Date(
    Date.parse(successfulRun.startedAt ?? successfulRun.createdAt) +
      index * 60_000,
  ).toISOString();
  const completedAt = new Date(
    Date.parse(successfulRun.completedAt ?? successfulRun.createdAt) +
      index * 60_000,
  ).toISOString();

  return {
    ...successfulRun,
    id: runId,
    actorEmail: `admin-${index}@example.com`,
    createdAt,
    startedAt,
    completedAt,
    logs: (successfulRun.logs ?? []).map((log) => ({
      ...log,
      id: `${log.id}-${index}`,
      runId,
    })),
    output: successfulRun.output
      ? {
          ...successfulRun.output,
          id: `${successfulRun.output.id}-${index}`,
          runId,
        }
      : null,
  };
}

describe("ApiConnectionDetailClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    dataGridSpy.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("shows one run history table and opens selected run details in a sheet", () => {
    render(
      <ApiConnectionDetailClient
        connection={connection}
        initialRuns={[successfulRun]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(screen.getByText("Source status")).toBeTruthy();
    expect(screen.getByText("Code-managed API")).toBeTruthy();
    expect(screen.getByText("Not imported yet")).toBeTruthy();
    expect(screen.queryByText("Pipeline")).toBeNull();
    expect(screen.queryByRole("button", { name: /Coming soon/ })).toBeNull();

    expect(screen.getByText("Run history")).toBeTruthy();
    expect(screen.queryByText("Run Detail")).toBeNull();
    expect(screen.queryByText("Ingestion History")).toBeNull();
    expect(screen.getByText("Initiated At")).toBeTruthy();
    expect(screen.getByText("Mode")).toBeTruthy();
    expect(screen.getByText("Actor")).toBeTruthy();
    expect(screen.getByText("Artifacts")).toBeTruthy();
    expect(screen.getAllByText("Test").length).toBeGreaterThan(0);
    expect(screen.getByText("admin@example.com")).toBeTruthy();
    expect(
      screen.getAllByText("Apr 24, 2026, 12:00 PM UTC").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Archived output artifacts.")).toBeNull();
    expect(
      document.querySelector(
        '[data-smoke-trigger="api-connection-run-detail-sheet"]',
      ),
    ).toBeTruthy();

    const rowJsonLink = screen.getAllByRole("link", { name: "JSON" })[0]!;
    rowJsonLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(rowJsonLink);
    expect(screen.queryByText("Run detail")).toBeNull();

    fireEvent.click(screen.getByText("admin@example.com").closest("tr")!);

    expect(screen.getByText("Run detail")).toBeTruthy();
    const runDetailSheet = document.querySelector(
      '[data-smoke-surface="api-connection-run-detail-sheet"][data-smoke-ready="api-connection-run-detail-sheet"]',
    );
    expect(runDetailSheet).toBeTruthy();
    expect(runDetailSheet?.className).toContain("sm:max-w-[50vw]");
    expect(screen.getByText("Archived output artifacts.")).toBeTruthy();
    expect(screen.getByText("[{\"name\":\"Alpha\"}]")).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: "JSON" })[0]?.getAttribute("href"),
    ).toBe(
      "/api/admin/api-connections/11111111-1111-4111-8111-111111111111/runs/22222222-2222-4222-8222-222222222222/download?format=json",
    );
    expect(
      screen.getAllByRole("link", { name: "CSV" })[0]?.getAttribute("href"),
    ).toBe(
      "/api/admin/api-connections/11111111-1111-4111-8111-111111111111/runs/22222222-2222-4222-8222-222222222222/download?format=csv",
    );
    expect(
      screen.getAllByRole("link", { name: /dataset/i })[0]?.getAttribute("href"),
    ).toBe("/dashboard/datasets/dataset-1");
    expect(dataGridSpy.mock.lastCall?.[0].recordCount).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Run detail")).toBeNull();
    expect(screen.getByText("Run history")).toBeTruthy();
    expect(screen.getByText("admin@example.com")).toBeTruthy();
  });

  it("restores queued test activity and replaces it with the terminal result", async () => {
    const queuedRun: ApiConnectionRun = {
      ...successfulRun,
      id: "active-test-run",
      mode: "test",
      status: "queued",
      httpStatus: null,
      durationMs: 0,
      rowCount: null,
      datasetId: null,
      startedAt: null,
      completedAt: null,
      logs: [],
      output: null,
    };
    const completedRun: ApiConnectionRun = {
      ...queuedRun,
      status: "success",
      durationMs: 2400,
      startedAt: queuedRun.createdAt,
      completedAt: "2026-04-24T12:00:02.400Z",
    };
    let resolveRunStatus!: (response: Response) => void;
    const runStatusResponse = new Promise<Response>((resolve) => {
      resolveRunStatus = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith(`/runs/${queuedRun.id}`)) return runStatusResponse;
        if (url.endsWith("/runs")) return Response.json({ runs: [completedRun] });
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <ApiConnectionDetailClient
        connection={connection}
        initialRuns={[queuedRun]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(screen.getByText("Waiting to test")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Connection test in progress" }),
    ).toBeTruthy();
    expect(document.querySelector("[data-smoke-api-connection-progress]")).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();

    await act(async () => {
      resolveRunStatus(Response.json({ run: completedRun }));
      await runStatusResponse;
    });

    await waitFor(() => {
      expect(screen.queryByText("Waiting to test")).toBeNull();
      expect(screen.getAllByText("Test passed").length).toBeGreaterThan(0);
    });
  });

  it("shows provider-independent ingestion activity and recovers poll freshness", async () => {
    const runningRun: ApiConnectionRun = {
      ...successfulRun,
      id: "active-ingestion-run",
      connectionId: googleSheetsConnection.id,
      mode: "import",
      status: "running",
      completedAt: null,
    };
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith(`/runs/${runningRun.id}`)) {
          attempts += 1;
          return attempts <= 2
            ? Response.json({ error: "Unavailable" }, { status: 503 })
            : Response.json({ run: runningRun });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <ApiConnectionDetailClient
        connection={googleSheetsConnection}
        initialRuns={[runningRun]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(screen.getByText("Ingesting source data")).toBeTruthy();
    expect(screen.getByText(/Curated data changes only after/)).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Dataset ingestion in progress" }),
    ).toBeTruthy();

    await waitFor(
      () => {
        expect(
          screen.getAllByText(/Current status cannot be confirmed/).length,
        ).toBeGreaterThan(0);
      },
      { timeout: 2500 },
    );
    await waitFor(
      () => expect(screen.getByText("Status checked just now.")).toBeTruthy(),
      { timeout: 2500 },
    );
    expect(screen.getByText("Ingesting source data")).toBeTruthy();
  });

  it("offers a formed candidate build for a successful IMB ingestion", async () => {
    const imbConnection = {
      ...connection,
      id: "6f9f6ef2-1188-4f71-9c24-ef01debf7a01",
      name: "IMB (People Groups)",
      sourceProfile: {
        key: "imb-people-groups",
        engineKey: "imb",
        label: "IMB forming",
        stableKeyColumn: null,
        configurable: false,
      },
    };
    const imbRun = {
      ...successfulRun,
      connectionId: imbConnection.id,
      sourceProfileSnapshot: {
        schemaVersion: 1 as const,
        connectionId: imbConnection.id,
        sourceProfileKey: "imb-people-groups",
        sourceProfileLabel: "IMB forming",
        stableKeyColumn: null,
        configurable: false,
        engineKey: "imb",
        engineLabel: "IMB forming",
        engineVersion: "imb-forming-v1",
        engineChecksum: "d".repeat(64),
        artifactSchemaVersion: 1,
        publicationTargetKey: "imb-people-groups",
      },
      sourceProfileChecksum: "e".repeat(64),
      mode: "import" as const,
      datasetId: null,
    };
    const buildingCandidate = {
      id: "77777777-7777-4777-8777-777777777777",
      connectionId: imbConnection.id,
      sourceRunId: imbRun.id,
      resourceSetId: "88888888-8888-4888-8888-888888888888",
      resourceSetChecksum: "e".repeat(64),
      countryVersionId: "99999999-9999-4999-8999-999999999991",
      ropVersionId: "99999999-9999-4999-8999-999999999992",
      sourceProfileKey: "imb-people-groups",
      engineKey: "imb",
      engineLabel: "IMB forming",
      artifactSchemaVersion: 1,
      inputFingerprint: "f".repeat(64),
      publicationTargetKey: "imb-people-groups",
      resourceBindings: [],
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.com",
      status: "building" as const,
      sourceRowsChecksum: "a".repeat(64),
      sourceRawChecksum: "b".repeat(64),
      fieldContractVersion: 1,
      fieldContractChecksum: "c".repeat(64),
      transformationVersion: "imb-forming-v1",
      transformationChecksum: "d".repeat(64),
      inputRowCount: 2,
      outputRowCount: null,
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
      downstreamIdentityRun: null,
      rejectionReason: null,
      rejectedByOwnerId: null,
      rejectedAt: null,
      publicationReason: null,
      warningsAcknowledged: false,
      publishedByOwnerId: null,
      publishedAt: null,
      publishingStartedAt: null,
      errorMessage: null,
      startedAt: "2026-04-24T12:00:00.000Z",
      completedAt: null,
      createdAt: "2026-04-24T12:00:00.000Z",
      findings: [],
      findingsTruncated: false,
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? Response.json({ formingRun: buildingCandidate }, { status: 202 })
        : Response.json({ formingRuns: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionDetailClient
        connection={imbConnection}
        initialRuns={[imbRun]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );
    fireEvent.click(screen.getByText("admin@example.com").closest("tr")!);

    expect(await screen.findByText("Formed dataset candidate")).toBeTruthy();
    expect(
      document.querySelector(
        '[data-smoke-surface="imb-forming-candidate-review"][data-smoke-ready="imb-forming-candidate-review"]',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Build formed candidate" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/api-connections/${imbConnection.id}/runs/${imbRun.id}/forming-candidates`,
        { method: "POST" },
      );
    });
    expect(await screen.findByText("Forming")).toBeTruthy();
    expect(screen.getByTitle("c".repeat(64)).className).toContain("truncate");
    expect(screen.getByTitle("d".repeat(64)).className).toContain("truncate");
    expect(
      screen.getByRole("button", { name: "Copy field contract checksum" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Copy transformation checksum" }),
    ).toBeTruthy();
  });

  it("links a published source candidate to its exact downstream identity lineage", async () => {
    const sourceConnection: ApiConnection = {
      ...connection,
      id: "6f9f6ef2-1188-4f71-9c24-ef01debf7a01",
      name: "IMB (People Groups)",
      sourceProfile: {
        key: "imb-people-groups",
        engineKey: "imb",
        label: "IMB forming",
        stableKeyColumn: null,
        configurable: false,
      },
    };
    const sourceRun: ApiConnectionRun = {
      ...successfulRun,
      connectionId: sourceConnection.id,
      sourceProfileSnapshot: {
        schemaVersion: 1,
        connectionId: sourceConnection.id,
        sourceProfileKey: "imb-people-groups",
        sourceProfileLabel: "IMB forming",
        stableKeyColumn: null,
        configurable: false,
        engineKey: "imb",
        engineLabel: "IMB forming",
        engineVersion: "imb-forming-v1",
        engineChecksum: "d".repeat(64),
        artifactSchemaVersion: 1,
        publicationTargetKey: "imb-people-groups",
      },
      sourceProfileChecksum: "e".repeat(64),
      mode: "import",
      datasetId: null,
    };
    const identityRunId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const identityPublicationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const registryRevisionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          formingRuns: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              connectionId: sourceConnection.id,
              sourceRunId: sourceRun.id,
              resourceSetId: "88888888-8888-4888-8888-888888888888",
              resourceSetChecksum: "e".repeat(64),
              countryVersionId: "99999999-9999-4999-8999-999999999991",
              ropVersionId: "99999999-9999-4999-8999-999999999992",
              sourceProfileKey: "imb-people-groups",
              engineKey: "imb",
              engineLabel: "IMB forming",
              artifactSchemaVersion: 1,
              inputFingerprint: "f".repeat(64),
              publicationTargetKey: "imb-people-groups",
              expectedCurrentPublicationId: null,
              resourceBindings: [],
              actorOwnerId: "admin-1",
              actorEmail: "admin@example.com",
              status: "published",
              sourceRowsChecksum: "a".repeat(64),
              sourceRawChecksum: "b".repeat(64),
              fieldContractVersion: 1,
              fieldContractChecksum: "c".repeat(64),
              transformationVersion: "imb-forming-v1",
              transformationChecksum: "d".repeat(64),
              inputRowCount: 2,
              outputRowCount: 2,
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
              outputChecksum: "1".repeat(64),
              outputSizeBytes: 256,
              datasetId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              publicationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              downstreamIdentityRun: {
                runId: identityRunId,
                status: "published",
                publicationId: identityPublicationId,
                registryRevisionId,
              },
              rejectionReason: null,
              rejectedByOwnerId: null,
              rejectedAt: null,
              publicationReason: "Approved source",
              warningsAcknowledged: false,
              publishedByOwnerId: "admin-1",
              publishedAt: "2026-04-24T12:05:00.000Z",
              publishingStartedAt: null,
              errorMessage: null,
              startedAt: "2026-04-24T12:00:00.000Z",
              completedAt: "2026-04-24T12:05:00.000Z",
              createdAt: "2026-04-24T12:00:00.000Z",
              findings: [],
              findingsTruncated: false,
            },
          ],
        }),
      ),
    );

    render(
      <ApiConnectionDetailClient
        connection={sourceConnection}
        initialRuns={[sourceRun]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );
    fireEvent.click(screen.getByText("admin@example.com").closest("tr")!);

    expect(await screen.findByText(identityPublicationId)).toBeTruthy();
    expect(screen.getByText(registryRevisionId)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: identityRunId }).getAttribute("href"),
    ).toBe(`/admin/identity-registry?runId=${identityRunId}`);
    expect(
      document.querySelector("[data-smoke-downstream-identity-lineage]"),
    ).toBeTruthy();
  });

  it("renders another source engine with its dynamic pinned resource bindings", async () => {
    const etnopediaConnection: ApiConnection = {
      ...connection,
      id: "6f9f6ef2-1188-4f71-9c24-ef01debf7a02",
      name: "Etnopedia",
      sourceProfile: {
        key: "etnopedia-people-groups",
        engineKey: "etnopedia",
        label: "Etnopedia forming",
        stableKeyColumn: null,
        configurable: false,
      },
    };
    const run: ApiConnectionRun = {
      ...successfulRun,
      connectionId: etnopediaConnection.id,
      sourceProfileSnapshot: {
        schemaVersion: 1,
        connectionId: etnopediaConnection.id,
        sourceProfileKey: "etnopedia-people-groups",
        sourceProfileLabel: "Etnopedia forming",
        stableKeyColumn: null,
        configurable: false,
        engineKey: "etnopedia",
        engineLabel: "Etnopedia forming",
        engineVersion: "etnopedia-forming-v1",
        engineChecksum: "d".repeat(64),
        artifactSchemaVersion: 1,
        publicationTargetKey: "etnopedia-people-groups",
      },
      sourceProfileChecksum: "e".repeat(64),
      mode: "import",
      datasetId: null,
    };
    const countryVersionId = "99999999-9999-4999-8999-999999999991";
    const countryChecksum = "7".repeat(64);
    const fieldContractChecksum = "8".repeat(64);
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: clipboardWrite } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          formingRuns: [{
            id: "77777777-7777-4777-8777-777777777778",
            connectionId: etnopediaConnection.id,
            sourceRunId: run.id,
            resourceSetId: "88888888-8888-4888-8888-888888888888",
            resourceSetChecksum: "e".repeat(64),
            countryVersionId,
            ropVersionId: "99999999-9999-4999-8999-999999999992",
            sourceProfileKey: "etnopedia-people-groups",
            engineKey: "etnopedia",
            engineLabel: "Etnopedia source forming",
            artifactSchemaVersion: 1,
            inputFingerprint: "f".repeat(64),
            publicationTargetKey: "etnopedia-people-groups",
            resourceBindings: [{
              position: 0,
              key: "country-territory-codes",
              bindingType: "catalog",
              required: true,
              kind: "country-geography",
              schemaVersion: 1,
              version: "2",
              checksum: countryChecksum,
              resourceSetId: "88888888-8888-4888-8888-888888888888",
              resourceSetChecksum: "e".repeat(64),
              resourceId: "resource-country",
              resourceVersionId: countryVersionId,
            }, {
              position: 1,
              key: "etnopedia-field-contract",
              bindingType: "code",
              required: true,
              kind: "field-contract",
              schemaVersion: 1,
              version: "v1",
              checksum: fieldContractChecksum,
              resourceSetId: null,
              resourceSetChecksum: null,
              resourceId: null,
              resourceVersionId: null,
            }],
            actorOwnerId: "admin-1",
            actorEmail: "admin@example.com",
            status: "valid",
            sourceRowsChecksum: "a".repeat(64),
            sourceRawChecksum: "b".repeat(64),
            fieldContractVersion: 1,
            fieldContractChecksum,
            transformationVersion: "etnopedia-forming-v1",
            transformationChecksum: "d".repeat(64),
            inputRowCount: 2,
            outputRowCount: 2,
            warningCount: 0,
            errorCount: 0,
            validationSummary: {
              warningCount: 0,
              errorCount: 0,
              inputRowCount: 2,
              outputRowCount: 2,
              missingStableKeyRows: 1,
              duplicateStableKeyRows: 0,
              duplicateDomainKeyRows: 0,
              unresolvedCountryRows: 0,
              ambiguousCountryRows: 0,
              unresolvedRopRows: 0,
              countryConflictRows: 0,
              ropParentConflictRows: 0,
              invalidValueCount: 0,
              schemaDriftFields: [],
            },
            artifactManifest: {},
            outputChecksum: "1".repeat(64),
            outputSizeBytes: 256,
            datasetId: null,
            publicationId: null,
            downstreamIdentityRun: null,
            rejectionReason: null,
            rejectedByOwnerId: null,
            rejectedAt: null,
            publicationReason: null,
            warningsAcknowledged: false,
            publishedByOwnerId: null,
            publishedAt: null,
            publishingStartedAt: null,
            errorMessage: null,
            startedAt: "2026-04-24T12:00:00.000Z",
            completedAt: "2026-04-24T12:05:00.000Z",
            createdAt: "2026-04-24T12:00:00.000Z",
            findings: [],
            findingsTruncated: false,
          }],
        }),
      ),
    );
    render(
      <ApiConnectionDetailClient
        connection={etnopediaConnection}
        initialRuns={[run]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );
    fireEvent.click(screen.getByText("admin@example.com").closest("tr")!);
    expect(await screen.findByText("Formed dataset candidate")).toBeTruthy();
    expect(
      screen.getByText(
        /Etnopedia source forming engine and resource rules/,
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Etnopedia source forming/u).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Validation summary")).toBeTruthy();
    expect(screen.getByText("Missing stable-key rows")).toBeTruthy();
    expect(screen.getByText("country-territory-codes")).toBeTruthy();
    expect(screen.getByText("etnopedia-field-contract")).toBeTruthy();
    expect(screen.queryByText("Country version")).toBeNull();
    expect(screen.queryByText("ROP version")).toBeNull();
    const versionValue = screen.getByTitle(countryVersionId);
    expect(versionValue.className).toContain("truncate");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy country-territory-codes checksum",
      }),
    );
    expect(clipboardWrite).toHaveBeenCalledWith(countryChecksum);
  });

  it("links an existing Google Sheet to a Tier 1 workflow", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        assignment: {
          sheetId: 1,
          kind: "tier1",
          sourceProfileKey: "wcd-people-groups",
          stableKeyColumn: "Record ID",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ApiConnectionDetailClient
        connection={{ ...googleSheetsConnection, sourceProfile: null }}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );
    fireEvent.change(screen.getByLabelText("Data workflow"), {
      target: { value: "tier1-wcd" },
    });
    fireEvent.change(screen.getByLabelText("Permanent source-row ID column"), {
      target: { value: "Record ID" },
    });
    const linkWorkflowButton = screen.getByRole("button", {
      name: "Link workflow",
    });
    expect(linkWorkflowButton.getAttribute("data-smoke-write")).toBe("unsafe");
    fireEvent.click(linkWorkflowButton);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/api-connections/${googleSheetsConnection.id}/workflow`,
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("links an existing engagement dataset to an exact Tier 2 workflow", async () => {
    const fetchMock = vi.fn(async () => Response.json({ assignment: {} }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ApiConnectionDetailClient
        connection={{ ...googleSheetsConnection, sourceProfile: null }}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
        tier2OwnerOptions={[{ key: "accelerate", label: "Accelerate" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Data workflow"), {
      target: { value: "tier2" },
    });
    fireEvent.change(screen.getByLabelText("Dataset owner"), {
      target: { value: "accelerate" },
    });
    fireEvent.change(screen.getByLabelText("Permanent Tier 2 row ID"), {
      target: { value: "Record ID" },
    });
    fireEvent.change(screen.getByLabelText("Tracking ID column"), {
      target: { value: "Tracking ID" },
    });
    fireEvent.change(screen.getByLabelText("Country evidence column"), {
      target: { value: "Country" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Link workflow" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/api-connections/${googleSheetsConnection.id}/workflow`,
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"kind":"tier2"'),
        }),
      ),
    );
  });

  it("links a mixed-source engagement dataset with an explicit row map", async () => {
    const fetchMock = vi.fn(async () => Response.json({ assignment: {} }));
    vi.stubGlobal("fetch", fetchMock);
    if (googleSheetsConnection.providerConfig?.provider !== "google_sheets") {
      throw new Error("Expected the Google Sheets connection fixture.");
    }
    const mixedConnection: ApiConnection = {
      ...googleSheetsConnection,
      providerConfig: {
        ...googleSheetsConnection.providerConfig,
        headerSelection: {
          ...googleSheetsConnection.providerConfig.headerSelection!,
          headers: [
            "Record ID",
            "Tracking ID",
            "Tracking source",
            "ROP3",
            "Country",
          ],
        },
      },
    };
    render(
      <ApiConnectionDetailClient
        connection={mixedConnection}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
        tier2OwnerOptions={[{ key: "accelerate", label: "Accelerate" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Data workflow"), {
      target: { value: "tier2" },
    });
    fireEvent.change(screen.getByLabelText("Dataset owner"), {
      target: { value: "accelerate" },
    });
    fireEvent.change(screen.getByLabelText("Permanent Tier 2 row ID"), {
      target: { value: "Record ID" },
    });
    fireEvent.change(screen.getByLabelText("Tracking ID type"), {
      target: { value: "per-row" },
    });
    fireEvent.change(screen.getByLabelText("Tracking-type column"), {
      target: { value: "Tracking source" },
    });
    fireEvent.change(screen.getByLabelText("Tracking ID column"), {
      target: { value: "Tracking ID" },
    });
    fireEvent.change(screen.getByLabelText("Tracking source value 1"), {
      target: { value: "PGID3 (Joshua Project)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add source value" }));
    fireEvent.change(screen.getByLabelText("Tracking source value 2"), {
      target: { value: "ROP3" },
    });
    fireEvent.change(screen.getByLabelText("Tracking source type 2"), {
      target: { value: "rop3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Link workflow" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = (
      fetchMock.mock.calls.at(-1) as unknown as
        | [RequestInfo | URL, RequestInit]
        | undefined
    )?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      trackingIdSource: null,
      trackingIdSourceColumn: "Tracking source",
      trackingIdSourceMappings: [
        {
          sourceValue: "PGID3 (Joshua Project)",
          trackingIdSource: "peopleid3",
        },
        { sourceValue: "ROP3", trackingIdSource: "rop3" },
      ],
    });
  });

  it("shows an active workflow read-only without a relink control", () => {
    render(
      <ApiConnectionDetailClient
        connection={{ ...googleSheetsConnection, sourceProfile: null }}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
        initialWorkflow={{
          sheetId: 1,
          kind: "tier2",
          ownerKey: "accelerate",
          feedKey: "final-58",
          feedName: "Final-58",
          stableRowKeyColumn: "Record ID",
          trackingIdColumn: "Tracking ID",
          trackingIdSource: "peopleid3",
          trackingIdSourceColumn: null,
          trackingIdSourceMappings: [],
          sourceRop3Column: "ROP3",
          sourceCountryColumn: "Country",
          sourceIso3Column: null,
        }}
        tier2OwnerOptions={[{ key: "accelerate", label: "Accelerate" }]}
      />,
    );
    expect(screen.getByText("Active workflow")).toBeTruthy();
    expect(screen.getByText(/This assignment is read-only/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Link workflow" })).toBeNull();
  });

  it("starts ingestion through the existing run endpoint and polls active runs", async () => {
    const queuedRun: ApiConnectionRun = {
      ...successfulRun,
      id: "66666666-6666-4666-8666-666666666666",
      mode: "import",
      status: "queued",
      httpStatus: null,
      durationMs: 0,
      rowCount: null,
      datasetId: null,
      responsePreview: "",
      startedAt: null,
      completedAt: null,
      logs: [],
      output: null,
    };
    const completedRun: ApiConnectionRun = {
      ...queuedRun,
      status: "success",
      httpStatus: 200,
      durationMs: 120,
      rowCount: 4,
      responsePreview: "[{\"name\":\"Beta\"}]",
      startedAt: "2026-04-24T12:00:03.000Z",
      completedAt: "2026-04-24T12:00:04.000Z",
      logs: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          runId: queuedRun.id,
          connectionId: connection.id,
          level: "info",
          message: "Run completed.",
          createdAt: "2026-04-24T12:00:04.000Z",
        },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/run")) {
        expect(init).toMatchObject({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importEnabled: true }),
        });

        return {
          ok: true,
          json: async () => ({ connection, run: queuedRun }),
        };
      }

      if (url.endsWith(`/runs/${queuedRun.id}`)) {
        return {
          ok: true,
          json: async () => ({ run: completedRun }),
        };
      }

      if (url.endsWith("/runs")) {
        return {
          ok: true,
          json: async () => ({ runs: [completedRun] }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionDetailClient
        connection={connection}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start ingestion" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/api-connections/11111111-1111-4111-8111-111111111111/run",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ importEnabled: true }),
        }),
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/api-connections/11111111-1111-4111-8111-111111111111/runs/66666666-6666-4666-8666-666666666666",
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Import passed").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByText("admin@example.com").closest("tr")!);
    expect(screen.getByText("Run completed.")).toBeTruthy();
    expect(screen.getByText("[{\"name\":\"Beta\"}]")).toBeTruthy();
  });

  it("labels Google Sheets import actions as dataset refreshes after first import", () => {
    render(
      <ApiConnectionDetailClient
        connection={googleSheetsConnection}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(screen.getByText("Refresh dataset")).toBeTruthy();
    expect(screen.queryByText("Start ingestion")).toBeNull();
    expect(
      screen.getByText(
        "Test the source, import the latest rows, or review the last result.",
      ),
    ).toBeTruthy();
  });

  it("shows Google Sheets source actions and labels first imports clearly", () => {
    const firstImportConnection: ApiConnection = {
      ...googleSheetsConnection,
      targetDatasetId: null,
    };

    render(
      <ApiConnectionDetailClient
        connection={firstImportConnection}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(screen.getByText("Google Sheets source")).toBeTruthy();
    expect(screen.getByText("Mission Sheet")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText(serviceAccountEmail)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import sheet" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start ingestion" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open Google Sheet" }).getAttribute("href"),
    ).toBe("https://docs.google.com/spreadsheets/d/sheet_123/edit");
    expect(screen.queryByRole("link", { name: "Open dataset" })).toBeNull();
  });

  it("checks Google Sheets access, copies app email, opens dataset, and disconnects", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith(`/google-sheets/${googleSheetsConnection.id}`)) {
        if (init?.method === "DELETE") {
          return Response.json({ connection: googleSheetsConnection });
        }

        return Response.json({
          connection: googleSheetsConnection,
          serviceAccountEmail,
          preview: {
            spreadsheetId: "sheet_123",
            spreadsheetUrl:
              "https://docs.google.com/spreadsheets/d/sheet_123/edit",
            spreadsheetTitle: "Mission Sheet",
            sheets: [{ sheetId: 1, title: "Alpha", index: 0 }],
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionDetailClient
        connection={googleSheetsConnection}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Open dataset" }).getAttribute("href"),
    ).toBe("/dashboard/datasets/dataset-1");

    fireEvent.click(screen.getByRole("button", { name: "Copy app email" }));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(serviceAccountEmail);
    });

    fireEvent.click(screen.getByRole("button", { name: "Check access" }));
    expect(await screen.findByText("Google Sheets access confirmed")).toBeTruthy();
    expect(
      screen.getByText(
        "Mission Sheet / Alpha is readable by the app service account.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm disconnect" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/admin/api-connections/google-sheets/${googleSheetsConnection.id}`,
        { method: "DELETE" },
      );
      expect(pushMock).toHaveBeenCalledWith("/dashboard/api-connections");
    });
  });

  it("previews and saves a manual multi-row Google Sheets header", async () => {
    const preview = {
      sheetId: 1,
      sheetTitle: "Alpha",
      inspectedRowCount: 5,
      candidates: [
        {
          rowNumber: 2,
          score: 7.2,
          confidence: "medium",
          values: ["Identity", "Engagement"],
        },
        {
          rowNumber: 3,
          score: 8.7,
          confidence: "high",
          values: ["People Group", "Country"],
        },
      ],
      recommendedRow: 3,
      selected: {
        mode: "auto",
        startRow: 3,
        endRow: 3,
        headers: ["People Group", "Country"],
        fingerprint: "fingerprint",
        confidence: "high",
      },
      sampleRows: [["Khmu", "Laos"]],
    } as const;
    const combinedPreview = {
      ...preview,
      selected: {
        ...preview.selected,
        mode: "manual" as const,
        startRow: 2,
        endRow: 3,
        headers: ["Identity / People Group", "Engagement / Country"],
      },
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        expect(init.body).toBe(
          JSON.stringify({
            selection: { sheetId: 1, mode: "manual", startRow: 2, endRow: 3 },
          }),
        );
        return Response.json({
          connection: googleSheetsConnection,
          preview: combinedPreview,
        });
      }
      const request = JSON.parse(String(init?.body ?? "{}")) as {
        selection?: { startRow: number; endRow: number };
      };
      return Response.json({
        preview: request.selection ? combinedPreview : preview,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionDetailClient
        connection={googleSheetsConnection}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Review headers" }));
    expect(await screen.findByLabelText("Header row for Alpha")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Cancel" }).getAttribute(
        "data-smoke-close",
      ),
    ).toBe("google-sheets-header-selection");
    fireEvent.change(screen.getByLabelText("Header row for Alpha"), {
      target: { value: "2" },
    });
    await waitFor(() => {
      expect(screen.getByText("Identity / People Group")).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText("Header rows to combine for Alpha"), {
      target: { value: "2" },
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/admin/api-connections/google-sheets/${googleSheetsConnection.id}`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            selection: { sheetId: 1, mode: "manual", startRow: 2, endRow: 3 },
          }),
        }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Save header selection" }));
    expect(await screen.findByText("Header selection saved")).toBeTruthy();
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("refreshes the server page once when a first Google Sheets import finishes", async () => {
    const queuedRun: ApiConnectionRun = {
      ...successfulRun,
      id: "66666666-6666-4666-8666-666666666666",
      connectionId: googleSheetsConnection.id,
      mode: "import",
      status: "queued",
      datasetId: null,
    };
    const completedRun: ApiConnectionRun = {
      ...queuedRun,
      status: "success",
      datasetId: "dataset-created-by-import",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/runs/${queuedRun.id}`)) {
        return Response.json({ run: completedRun });
      }
      if (url.endsWith("/runs")) {
        return Response.json({ runs: [completedRun] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionDetailClient
        connection={{ ...googleSheetsConnection, targetDatasetId: null }}
        initialRuns={[queuedRun]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    await waitFor(() => expect(refreshMock).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("preserves dataset navigation when a Google Sheets refresh finishes", async () => {
    const runningRun: ApiConnectionRun = {
      ...successfulRun,
      id: "88888888-8888-4888-8888-888888888888",
      connectionId: googleSheetsConnection.id,
      mode: "import",
      status: "running",
      datasetId: googleSheetsConnection.targetDatasetId,
    };
    const completedRun: ApiConnectionRun = {
      ...runningRun,
      status: "success",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/runs/${runningRun.id}`)) {
        return Response.json({ run: completedRun });
      }
      if (url.endsWith("/runs")) {
        return Response.json({ runs: [completedRun] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionDetailClient
        connection={googleSheetsConnection}
        initialRuns={[runningRun]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Open dataset" }).getAttribute("href"),
    ).toBe("/dashboard/datasets/dataset-1");
    await waitFor(() => expect(refreshMock).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("link", { name: "Open dataset" }).getAttribute("href"),
    ).toBe("/dashboard/datasets/dataset-1");
  });

  it("shows a terminal import failure without refreshing or exposing a new dataset", async () => {
    const queuedRun: ApiConnectionRun = {
      ...successfulRun,
      id: "77777777-7777-4777-8777-777777777777",
      connectionId: googleSheetsConnection.id,
      mode: "import",
      status: "running",
      datasetId: null,
      errorMessage: null,
    };
    const failedRun: ApiConnectionRun = {
      ...queuedRun,
      status: "failed",
      errorMessage: "Review and save the Google Sheet header row before importing.",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/runs/${queuedRun.id}`)) {
        return Response.json({ run: failedRun });
      }
      if (url.endsWith("/runs")) {
        return Response.json({ runs: [failedRun] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionDetailClient
        connection={{ ...googleSheetsConnection, targetDatasetId: null }}
        initialRuns={[queuedRun]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(
      await screen.findByText(
        "Review and save the Google Sheet header row before importing.",
      ),
    ).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Open dataset" })).toBeNull();
  });

  it("selects a run row and updates the run detail panel", () => {
    const passedRun: ApiConnectionRun = {
      ...successfulRun,
      actorEmail: "success@example.com",
    };
    const failedRun: ApiConnectionRun = {
      ...successfulRun,
      id: "88888888-8888-4888-8888-888888888888",
      status: "failed",
      errorMessage: "API request failed.",
      responsePreview: "failure body",
      logs: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          runId: "88888888-8888-4888-8888-888888888888",
          connectionId: connection.id,
          level: "error",
          message: "API request failed.",
          createdAt: "2026-04-24T12:05:00.000Z",
        },
      ],
      output: null,
      datasetId: null,
      createdAt: "2026-04-24T12:05:00.000Z",
    };

    render(
      <ApiConnectionDetailClient
        connection={connection}
        initialRuns={[failedRun, passedRun]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(screen.getAllByText("Test failed").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("success@example.com").closest("tr")!);

    expect(screen.getByText("Run detail")).toBeTruthy();
    expect(screen.getAllByText("Test passed").length).toBeGreaterThan(0);
    expect(screen.getByText("Archived output artifacts.")).toBeTruthy();
    expect(screen.getByText("[{\"name\":\"Alpha\"}]")).toBeTruthy();
  });

  it("caps run history to a five-row viewport when more runs are available", () => {
    render(
      <ApiConnectionDetailClient
        connection={connection}
        initialRuns={Array.from({ length: 6 }, (_, index) =>
          createHistoryRun(index),
        )}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(screen.getByTestId("data-grid-scroll-area").className).toContain(
      "h-[268px]",
    );
    expect(dataGridSpy.mock.lastCall?.[0].recordCount).toBe(6);
  });
});
