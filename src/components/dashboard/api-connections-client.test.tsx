// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiConnectionsClient } from "@/components/dashboard/api-connections-client";
import type { ApiConnection, ApiConnectionRun } from "@/lib/api-types";

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
  datasetId: null,
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

describe("ApiConnectionsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders saved connections as a run-only dashboard", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ runs: [] }),
      }),
    );

    render(
      <ApiConnectionsClient
        initialConnections={[connection]}
        initialRuns={[]}
      />,
    );

    expect(screen.getByRole("button", { name: /People API/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Test" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();

    expect(screen.queryByRole("button", { name: "New API connection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Joshua Project (PGIC)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "IMB (People Groups)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Etnopedia" })).toBeNull();
    expect(screen.queryByLabelText("URL")).toBeNull();
    expect(screen.queryByLabelText("Method")).toBeNull();
    expect(screen.queryByLabelText("Header name")).toBeNull();
    expect(screen.queryByLabelText("Response format")).toBeNull();
    expect(screen.queryByLabelText("Dataset name")).toBeNull();
  });

  it("does not offer web creation when no saved connections exist", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
      />,
    );

    expect(screen.getByText("No API connections are available.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New API connection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Test" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
  });

  it("queues a saved connection in import mode", async () => {
    const run: ApiConnectionRun = {
      ...successfulRun,
      mode: "import",
      status: "queued",
      httpStatus: null,
      durationMs: 0,
      rowCount: null,
      responsePreview: "",
      startedAt: null,
      completedAt: null,
      logs: [],
      output: null,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/runs")) {
        return {
          ok: true,
          json: async () => ({ runs: [] }),
        };
      }

      if (url.endsWith(`/runs/${run.id}`)) {
        return {
          ok: true,
          json: async () => ({ run }),
        };
      }

      return {
        ok: true,
        json: async () => ({ connection, run }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionsClient
        initialConnections={[connection]}
        initialRuns={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/api-connections/11111111-1111-4111-8111-111111111111/run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importEnabled: true }),
        },
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Import queued").length).toBeGreaterThan(0);
    });
  });

  it("shows archived output downloads and logs", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ runs: [] }),
      }),
    );

    render(
      <ApiConnectionsClient
        initialConnections={[connection]}
        initialRuns={[successfulRun]}
      />,
    );

    expect(screen.getByText("Archived output artifacts.")).toBeTruthy();
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
  });
});
