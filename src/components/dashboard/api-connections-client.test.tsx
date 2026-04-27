// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiConnectionsClient } from "@/components/dashboard/api-connections-client";

describe("ApiConnectionsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a saved API connection with a secret header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connection: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "People API",
          description: "",
          method: "GET",
          url: "https://api.example.com/people",
          headers: [{ name: "Authorization", value: "", isSecret: true }],
          bodyTemplate: "",
          responseFormat: "json",
          responseDataPath: "data",
          importMode: "create",
          targetDatasetId: null,
          datasetName: "people.csv",
          datasetClassification: "PGAC",
          createdAt: "2026-04-24T12:00:00.000Z",
          updatedAt: "2026-04-24T12:00:00.000Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        datasets={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "People API" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://api.example.com/people" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Secret" }));
    fireEvent.change(screen.getByLabelText("Header name"), {
      target: { value: "Authorization" },
    });
    fireEvent.change(screen.getByLabelText("Header value"), {
      target: { value: "Bearer token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/api-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      });
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.headers).toEqual([
      { name: "Authorization", value: "Bearer token", isSecret: true },
    ]);
    expect(await screen.findByText("Connection saved")).toBeTruthy();
  });

  it("queues a saved connection in import mode", async () => {
    const connection = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "People API",
      description: "",
      method: "GET" as const,
      url: "https://api.example.com/people",
      headers: [],
      bodyTemplate: "",
      responseFormat: "json" as const,
      responseDataPath: "data",
      importMode: "create" as const,
      targetDatasetId: null,
      datasetName: "people.csv",
      datasetClassification: "PGAC" as const,
      createdAt: "2026-04-24T12:00:00.000Z",
      updatedAt: "2026-04-24T12:00:00.000Z",
    };
    const run = {
      id: "22222222-2222-4222-8222-222222222222",
      connectionId: connection.id,
      actorOwnerId: "admin-1",
      actorEmail: "admin@example.com",
      mode: "import" as const,
      status: "queued" as const,
      httpStatus: null,
      durationMs: 0,
      rowCount: null,
      datasetId: null,
      errorMessage: null,
      responsePreview: "",
      startedAt: null,
      completedAt: null,
      createdAt: "2026-04-24T12:00:00.000Z",
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
        datasets={[]}
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
        initialConnections={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "People API",
            description: "",
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
          },
        ]}
        initialRuns={[
          {
            id: "22222222-2222-4222-8222-222222222222",
            connectionId: "11111111-1111-4111-8111-111111111111",
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
                connectionId: "11111111-1111-4111-8111-111111111111",
                level: "info",
                message: "Archived output artifacts.",
                createdAt: "2026-04-24T12:00:02.000Z",
              },
            ],
            output: {
              id: "55555555-5555-4555-8555-555555555555",
              runId: "22222222-2222-4222-8222-222222222222",
              connectionId: "11111111-1111-4111-8111-111111111111",
              rowCount: 2,
              columns: [{ key: "name", label: "Name", sourceIndex: 0 }],
              rowsStoragePath: "api-connection-runs/run/rows.json",
              rawStoragePath: "api-connection-runs/run/raw-response.json",
              rowsSizeBytes: 20,
              rawSizeBytes: 24,
              createdAt: "2026-04-24T12:00:02.000Z",
            },
          },
        ]}
        datasets={[]}
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
