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

  it("runs a saved connection in import mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connection: {
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
        run: {
          id: "22222222-2222-4222-8222-222222222222",
          connectionId: "11111111-1111-4111-8111-111111111111",
          actorOwnerId: "admin-1",
          actorEmail: "admin@example.com",
          mode: "import",
          status: "success",
          httpStatus: 200,
          durationMs: 33,
          rowCount: 2,
          datasetId: "33333333-3333-4333-8333-333333333333",
          errorMessage: null,
          responsePreview: "[{\"name\":\"Alpha\"}]",
          createdAt: "2026-04-24T12:00:00.000Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

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
      expect(screen.getAllByText("Import passed").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.getAllByText("2 rows").length).toBeGreaterThan(0);
    });
  });
});
