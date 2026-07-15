// @vitest-environment jsdom

import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  },
  importMode: "replace",
  targetDatasetId: "dataset-1",
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
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("renders pipeline skeleton stages and starts run panels collapsed in detail-first order", () => {
    render(
      <ApiConnectionDetailClient
        connection={connection}
        initialRuns={[successfulRun]}
        serviceAccountEmail={serviceAccountEmail}
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
        connection={googleSheetsConnection}
        initialRuns={[]}
        serviceAccountEmail={serviceAccountEmail}
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
        serviceAccountEmail={serviceAccountEmail}
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
