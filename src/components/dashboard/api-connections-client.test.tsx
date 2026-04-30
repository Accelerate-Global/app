// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
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
  category: "Film",
  webText: "Watch",
  sourceRowIndex: 0,
  sourceResourceIndex: 1,
  createdAt: "2026-04-24T12:03:00.000Z",
};

describe("ApiConnectionsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(screen.getByText("Connection")).toBeTruthy();
    expect(screen.getByText("Classification")).toBeTruthy();
    expect(screen.getByText("Last ingestion")).toBeTruthy();
    expect(screen.queryByText("Status")).toBeNull();
    expect(screen.getByText("People API")).toBeTruthy();
    expect(screen.getByText("IMB (People Groups)")).toBeTruthy();
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

  it("does not offer web creation when no saved connections exist", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        initialResources={[]}
      />,
    );

    expect(screen.getByText("No connections are available.")).toBeTruthy();
    expect(screen.getByText("No resources have been captured yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New API connection" })).toBeNull();
  });

  it("renders captured resources in a second read-only grid", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[pgicConnection]}
        initialRuns={[queuedRun]}
        initialResources={[resource]}
      />,
    );

    expect(screen.getByText("Resources")).toBeTruthy();
    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.getByText("Display text")).toBeTruthy();
    expect(screen.getByText("URL")).toBeTruthy();
    expect(screen.getByText("Film")).toBeTruthy();
    expect(screen.getByText("Watch")).toBeTruthy();
    expect(screen.getByText("https://example.com/film#watch")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open/ }).getAttribute("href")).toBe(
      "https://example.com/film#watch",
    );
  });
});
