// @vitest-environment jsdom

import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Table as ReactTable } from "@tanstack/react-table";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiConnectionDetailClient } from "@/components/dashboard/api-connection-detail-client";
import type { ApiConnection, ApiConnectionRun } from "@/lib/api-types";

const { dataGridSpy } = vi.hoisted(() => ({
  dataGridSpy: vi.fn(),
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

const successfulRun: ApiConnectionRun = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: connection.id,
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
  });

  it("renders pipeline skeleton stages and starts run panels collapsed in detail-first order", () => {
    render(
      <ApiConnectionDetailClient
        connection={connection}
        initialRuns={[successfulRun]}
      />,
    );

    expect(screen.getByText("Pipeline")).toBeTruthy();
    expect(screen.getByText("Configure")).toBeTruthy();
    expect(screen.getByText("Fetch")).toBeTruthy();
    expect(screen.getByText("Normalize")).toBeTruthy();
    expect(screen.getByText("Archive Output")).toBeTruthy();
    expect(screen.getByText("Import Dataset")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /Coming soon/ }).every((button) =>
        button.hasAttribute("disabled"),
      ),
    ).toBe(true);

    const runDetailTitle = screen.getByText("Run Detail");
    const historyTitle = screen.getByText("Ingestion History");
    expect(
      runDetailTitle.compareDocumentPosition(historyTitle) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Expand Run Detail" }).getAttribute(
        "aria-expanded",
      ),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Expand Ingestion History" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByText("Initiated At")).toBeNull();
    expect(screen.queryByText("Archived output artifacts.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand Run Detail" }));
    expect(screen.getByText("Archived output artifacts.")).toBeTruthy();
    expect(screen.getByText("[{\"name\":\"Alpha\"}]")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Expand Ingestion History" }),
    );
    expect(screen.getByText("Initiated At")).toBeTruthy();
    expect(screen.getByText("Mode")).toBeTruthy();
    expect(screen.getByText("Actor")).toBeTruthy();
    expect(screen.getByText("Artifacts")).toBeTruthy();
    expect(screen.getAllByText("Test").length).toBeGreaterThan(0);
    expect(screen.getByText("admin@example.com")).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Expand Run Detail" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/api-connections/11111111-1111-4111-8111-111111111111/runs/66666666-6666-4666-8666-666666666666",
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Import passed").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Run completed.")).toBeTruthy();
    expect(screen.getByText("[{\"name\":\"Beta\"}]")).toBeTruthy();
  });

  it("labels Google Sheets import actions as dataset refreshes after first import", () => {
    render(
      <ApiConnectionDetailClient
        connection={{
          ...connection,
          provider: "google_sheets",
          providerConfig: {
            provider: "google_sheets",
            spreadsheetId: "sheet_123",
            spreadsheetUrl:
              "https://docs.google.com/spreadsheets/d/sheet_123/edit",
            spreadsheetTitle: "Mission Sheet",
            sheetId: 1,
            sheetTitle: "Alpha",
            rangeMode: "full_tab",
          },
          importMode: "replace",
          targetDatasetId: "dataset-1",
        }}
        initialRuns={[]}
      />,
    );

    expect(screen.getByText("Refresh dataset")).toBeTruthy();
    expect(screen.queryByText("Start ingestion")).toBeNull();
    expect(
      screen.getByText(
        "Runs read the selected Google Sheet tab and import or refresh the dataset target.",
      ),
    ).toBeTruthy();
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
      />,
    );

    const detailToggle = screen.getByRole("button", { name: "Expand Run Detail" });
    fireEvent.click(
      screen.getByRole("button", { name: "Expand Ingestion History" }),
    );
    expect(screen.getAllByText("Test failed").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("success@example.com").closest("tr")!);

    expect(detailToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Archived output artifacts.")).toBeNull();
    fireEvent.click(detailToggle);
    expect(screen.getAllByText("Test passed").length).toBeGreaterThan(0);
    expect(screen.getByText("Archived output artifacts.")).toBeTruthy();
    expect(screen.getByText("[{\"name\":\"Alpha\"}]")).toBeTruthy();
  });

  it("caps ingestion history to a five-row viewport when more runs are available", () => {
    render(
      <ApiConnectionDetailClient
        connection={connection}
        initialRuns={Array.from({ length: 6 }, (_, index) =>
          createHistoryRun(index),
        )}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand Ingestion History" }),
    );

    expect(screen.getByTestId("data-grid-scroll-area").className).toContain(
      "h-[268px]",
    );
    expect(dataGridSpy.mock.lastCall?.[0].recordCount).toBe(6);
  });
});
