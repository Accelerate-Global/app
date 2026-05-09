// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiConnectionsClient } from "@/components/dashboard/api-connections-client";
import type {
  ApiConnection,
  ApiConnectionResource,
  ApiConnectionRun,
} from "@/lib/api-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

const pgacConnection: ApiConnection = {
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

const pgicConnection: ApiConnection = {
  ...pgacConnection,
  id: "33333333-3333-4333-8333-333333333333",
  name: "IMB (People Groups)",
  description: "IMB public ArcGIS people groups layer.",
  datasetName: "imb-people-groups.csv",
  datasetClassification: "PGIC",
};

const successfulRun: ApiConnectionRun = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: pgacConnection.id,
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
  logs: [],
  output: null,
};

const queuedRun: ApiConnectionRun = {
  ...successfulRun,
  id: "44444444-4444-4444-8444-444444444444",
  connectionId: pgicConnection.id,
  mode: "import",
  status: "queued",
  httpStatus: null,
  durationMs: 0,
  rowCount: null,
  responsePreview: "",
  startedAt: null,
  completedAt: null,
};

const resource: ApiConnectionResource = {
  id: "55555555-5555-4555-8555-555555555555",
  connectionId: pgicConnection.id,
  runId: queuedRun.id,
  resourceUrl: "https://example.com/film#watch",
  normalizedUrl: "https://example.com/film",
  webText: "Watch",
  sourceRowIndex: 0,
  sourceResourceIndex: 1,
  createdAt: "2026-04-24T12:03:00.000Z",
};

const resourceWithoutDisplayText: ApiConnectionResource = {
  id: "77777777-7777-4777-8777-777777777777",
  connectionId: pgicConnection.id,
  runId: queuedRun.id,
  resourceUrl: "https://example.com/no-label",
  normalizedUrl: "https://example.com/no-label",
  webText: "",
  sourceRowIndex: 1,
  sourceResourceIndex: 2,
  createdAt: "2026-04-24T12:04:00.000Z",
};

describe("ApiConnectionsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/dashboard/api-connections");
    pushMock.mockReset();
  });

  it("renders connections in the simplified table without filters or web profile controls", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[pgacConnection, pgicConnection]}
        initialRuns={[successfulRun, queuedRun]}
        initialResources={[]}
      />,
    );

    expect(screen.getByText("Connections")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Google Sheet" })).toBeTruthy();
    expect(screen.getByLabelText("Google Sheet link")).toBeTruthy();
    expect(screen.getByText("Connection")).toBeTruthy();
    expect(screen.getByText("Classification")).toBeTruthy();
    expect(screen.getByText("Last ingestion")).toBeTruthy();
    expect(screen.queryByText("Status")).toBeNull();
    expect(screen.getByText("People API")).toBeTruthy();
    expect(screen.getByText("IMB (People Groups)")).toBeTruthy();
    expect(screen.queryByText("people.csv")).toBeNull();
    expect(screen.queryByText("imb-people-groups.csv")).toBeNull();
    expect(screen.queryByText("Success")).toBeNull();
    expect(screen.queryByText("Queued")).toBeNull();
    expect(
      screen.queryByPlaceholderText("Search connection, dataset, or classification"),
    ).toBeNull();
    expect(screen.queryByText("All classifications")).toBeNull();
    expect(screen.queryByText("All statuses")).toBeNull();

    expect(screen.queryByRole("button", { name: "New API connection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Test" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
    expect(screen.queryByLabelText("URL")).toBeNull();
    expect(screen.queryByLabelText("Response format")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("routes to the detail page when a row is clicked or keyboard-selected", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[pgacConnection]}
        initialRuns={[successfulRun]}
        initialResources={[]}
      />,
    );

    fireEvent.click(screen.getByText("People API").closest("tr")!);
    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/api-connections/11111111-1111-4111-8111-111111111111",
    );

    pushMock.mockClear();
    fireEvent.keyDown(screen.getByText("People API").closest("tr")!, {
      key: "Enter",
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/api-connections/11111111-1111-4111-8111-111111111111",
    );

    pushMock.mockClear();
    fireEvent.keyDown(screen.getByText("People API").closest("tr")!, {
      key: " ",
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/dashboard/api-connections/11111111-1111-4111-8111-111111111111",
    );
  });

  it("offers only the Google Sheets creation flow when no saved connections exist", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        initialResources={[]}
      />,
    );

    expect(screen.getByText("No connections are available.")).toBeTruthy();
    expect(screen.getByText("Country & territory code resource")).toBeTruthy();
    expect(screen.getByText("ROP Codes resource")).toBeTruthy();
    expect(screen.queryByText("Category")).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Display text" }),
    ).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "URL" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Open" })).toBeNull();
    expect(screen.queryByText("/dashboard/country-codes")).toBeNull();
    expect(screen.queryByText("/dashboard/rop-codes")).toBeNull();
    expect(
      screen.queryByRole("link", {
        name: "Open Country & territory code resource",
      }),
    ).toBeNull();
    fireEvent.click(
      screen.getByText("Country & territory code resource").closest("tr")!,
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard/country-codes");
    pushMock.mockClear();
    fireEvent.click(screen.getByText("ROP Codes resource").closest("tr")!);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/rop-codes");
    pushMock.mockClear();
    fireEvent.keyDown(screen.getByText("ROP Codes resource").closest("tr")!, {
      key: "Enter",
    });
    expect(pushMock).toHaveBeenCalledWith("/dashboard/rop-codes");
    expect(
      screen.getByText("No API-run resources have been captured yet."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "New API connection" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Add Google Sheet" })).toBeTruthy();
  });

  it("loads a Google Sheets draft from OAuth callback state and confirms selected tabs", async () => {
    window.history.pushState(
      {},
      "",
      "/dashboard/api-connections?googleSheetDraft=draft-1",
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/google-sheets/drafts/draft-1")) {
        return Response.json({
          draft: {
            id: "draft-1",
            spreadsheetId: "sheet_123",
            spreadsheetUrl:
              "https://docs.google.com/spreadsheets/d/sheet_123/edit",
            spreadsheetTitle: "Mission Sheet",
            sheets: [
              { sheetId: 1, title: "Alpha", index: 0 },
              { sheetId: 2, title: "Beta", index: 1 },
            ],
            expiresAt: "2026-05-09T08:00:00.000Z",
            createdAt: "2026-05-09T07:45:00.000Z",
            updatedAt: "2026-05-09T07:45:00.000Z",
          },
        });
      }

      if (url.endsWith("/google-sheets/drafts/draft-1/confirm")) {
        expect(init).toMatchObject({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedSheetIds: [1],
            datasetClassification: "PGIC",
          }),
        });

        return Response.json(
          {
            connections: [
              {
                ...pgicConnection,
                id: "99999999-9999-4999-8999-999999999999",
                name: "Mission Sheet - Alpha",
                provider: "google_sheets",
              },
            ],
          },
          { status: 201 },
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        initialResources={[]}
      />,
    );

    expect(await screen.findByText("Select tabs from Mission Sheet")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Alpha"));
    fireEvent.change(screen.getByLabelText("Dataset classification"), {
      target: { value: "PGIC" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create connections" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/dashboard/api-connections/99999999-9999-4999-8999-999999999999",
      );
    });
  });

  it("renders captured resources as label-only read-only rows", () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ApiConnectionsClient
        initialConnections={[pgicConnection]}
        initialRuns={[queuedRun]}
        initialResources={[resource, resourceWithoutDisplayText]}
      />,
    );

    expect(screen.getByText("Resources")).toBeTruthy();
    expect(screen.getByText("Country & territory code resource")).toBeTruthy();
    expect(screen.getByText("ROP Codes resource")).toBeTruthy();
    expect(screen.queryByText("Category")).toBeNull();
    expect(screen.queryByText("Uncategorized")).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Display text" }),
    ).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "URL" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Open" })).toBeNull();
    expect(screen.getByText("Watch")).toBeTruthy();
    expect(screen.getByText("Captured resource")).toBeTruthy();
    expect(screen.queryByText("https://example.com/film#watch")).toBeNull();
    expect(screen.queryByText("https://example.com/no-label")).toBeNull();
    expect(screen.queryByRole("link", { name: "Open Watch" })).toBeNull();

    fireEvent.click(screen.getByText("Watch").closest("tr")!);
    expect(openMock).toHaveBeenCalledWith(
      "https://example.com/film#watch",
      "_blank",
      "noreferrer",
    );

    openMock.mockClear();
    fireEvent.click(screen.getByText("Captured resource").closest("tr")!);
    expect(openMock).toHaveBeenCalledWith(
      "https://example.com/no-label",
      "_blank",
      "noreferrer",
    );

    openMock.mockClear();
    fireEvent.keyDown(screen.getByText("Watch").closest("tr")!, {
      key: "Enter",
    });
    expect(openMock).toHaveBeenCalledWith(
      "https://example.com/film#watch",
      "_blank",
      "noreferrer",
    );
  });
});
