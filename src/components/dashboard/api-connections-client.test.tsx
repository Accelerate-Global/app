// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiConnectionsClient } from "./api-connections-client";
import type { ApiConnection, ApiConnectionRun } from "@/lib/api-types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const connection: ApiConnection = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Reviewed people dataset",
  description: "Private Google Sheets tab.",
  method: "GET",
  url: "https://docs.google.com/spreadsheets/d/sheet/edit",
  headers: [],
  bodyTemplate: "",
  responseFormat: "csv",
  responseDataPath: "",
  importMode: "create",
  targetDatasetId: null,
  datasetName: "Reviewed people dataset",
  datasetClassification: "PGIC",
  provider: "google_sheets",
  providerConfig: {
    provider: "google_sheets",
    spreadsheetId: "sheet",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet/edit",
    spreadsheetTitle: "Mission Sheet",
    sheetId: 1,
    sheetTitle: "People",
    rangeMode: "full_tab",
  },
  createdAt: "2026-04-24T12:00:00.000Z",
  updatedAt: "2026-04-24T12:00:00.000Z",
};

const run: ApiConnectionRun = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: connection.id,
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  mode: "import",
  status: "success",
  httpStatus: 200,
  durationMs: 30,
  rowCount: 2,
  datasetId: "dataset-1",
  errorMessage: null,
  responsePreview: "",
  startedAt: "2026-04-24T12:00:01.000Z",
  completedAt: "2026-04-24T12:00:02.000Z",
  createdAt: "2026-04-24T12:00:00.000Z",
};

describe("ApiConnectionsClient", () => {
  afterEach(() => pushMock.mockReset());

  it("renders operational sources without inline onboarding controls", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[connection]}
        initialRuns={[run]}
        capturedResources={[]}
        referenceResources={[]}
      />,
    );

    expect(screen.getByText("Datasets")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Add connection" })).toBeNull();
    expect(screen.getByText("Source")).toBeTruthy();
    expect(screen.getByText("Reviewed people dataset")).toBeTruthy();
    expect(
      screen.getByText("Google Sheet source: Mission Sheet / People"),
    ).toBeTruthy();
    expect(screen.queryByText("Add Google Sheet")).toBeNull();
    expect(screen.queryByLabelText("Google Sheet link")).toBeNull();
  });

  it("opens sources with pointer and keyboard interaction", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[connection]}
        initialRuns={[]}
        capturedResources={[]}
        referenceResources={[]}
      />,
    );
    const row = screen.getByText(connection.name).closest("tr")!;
    fireEvent.click(row);
    expect(pushMock).toHaveBeenCalledWith(
      `/dashboard/api-connections/${connection.id}`,
    );
    pushMock.mockClear();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(pushMock).toHaveBeenCalledWith(
      `/dashboard/api-connections/${connection.id}`,
    );
  });

  it("shows a guided empty state without secondary resources", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        capturedResources={[]}
        referenceResources={[]}
      />,
    );
    expect(screen.getByText("No datasets are connected.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Add connection" })).toBeNull();
    expect(screen.queryByText("Reference resources")).toBeNull();
  });

  it("renders catalog-backed and captured resources with useful metadata", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[connection]}
        initialRuns={[]}
        referenceResources={[{
          id: "resource-1",
          resourceKey: "country-territory-codes",
          resourceKind: "country-geography",
          label: "Country & territory code resource",
          description: "Shared geography codes",
          routePath: "/dashboard/country-codes",
          sortOrder: 10,
          activeVersion: {
            id: "version-1",
            resourceKey: "country-territory-codes",
            versionNumber: 3,
            lifecycleState: "valid",
            schemaVersion: 1,
            contentChecksum: "checksum",
            sourceRetrievedAt: "2026-04-23T12:00:00.000Z",
            entryCount: 249,
            validationSummary: {},
            diffSummary: {},
            createdByOwnerId: "admin-1",
            createdAt: "2026-04-23T12:00:00.000Z",
            finalizedAt: "2026-04-23T12:01:00.000Z",
            rejectionReason: null,
            isActive: true,
          },
        }]}
        capturedResources={[{
          id: "captured-1",
          connectionId: connection.id,
          runId: run.id,
          resourceUrl: "https://example.com/secret-path",
          normalizedUrl: "https://example.com/secret-path",
          webText: "Source documentation",
          sourceRowIndex: 0,
          sourceResourceIndex: 0,
          createdAt: run.createdAt,
        }]}
      />,
    );

    expect(screen.getAllByText("Source").length).toBeGreaterThan(0);
    expect(screen.getByText("Entries")).toBeTruthy();
    expect(screen.getByText("Last updated")).toBeTruthy();
    expect(screen.getByText("249")).toBeTruthy();
    expect(screen.getByText("Shared geography codes")).toBeTruthy();
    expect(screen.getByText("Source documentation")).toBeTruthy();
    expect(
      screen.getByText("Captured during Reviewed people dataset ingestion"),
    ).toBeTruthy();
    expect(screen.queryByText("https://example.com/secret-path")).toBeNull();
    expect(screen.queryByText("Category")).toBeNull();

    fireEvent.click(screen.getByText("Country & territory code resource").closest("tr")!);
    expect(pushMock).toHaveBeenCalledWith("/dashboard/country-codes");
  });
});
