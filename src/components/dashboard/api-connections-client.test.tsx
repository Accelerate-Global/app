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
const serviceAccountEmail = "sheets@app-project.iam.gserviceaccount.com";

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
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(screen.getByText("Connections")).toBeTruthy();
    expect(screen.getByText("Add Google Sheet")).toBeTruthy();
    expect(screen.getByText(serviceAccountEmail)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy app email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check access" })).toBeTruthy();
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
        serviceAccountEmail={serviceAccountEmail}
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
        serviceAccountEmail={serviceAccountEmail}
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
    expect(screen.getByRole("button", { name: "Check access" })).toBeTruthy();
  });

  it("checks Google Sheets access and connects selected tabs", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/google-sheets/check-access")) {
        expect(init).toMatchObject({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
          }),
        });

        return Response.json({
          preview: {
            spreadsheetId: "sheet_123",
            spreadsheetUrl:
              "https://docs.google.com/spreadsheets/d/sheet_123/edit",
            spreadsheetTitle: "Mission Sheet",
            sheets: [
              { sheetId: 1, title: "Alpha", index: 0 },
              { sheetId: 2, title: "Beta", index: 1 },
            ],
          },
          serviceAccountEmail: "sheets@app-project.iam.gserviceaccount.com",
        });
      }

      if (url.endsWith("/google-sheets/connect")) {
        expect(init).toMatchObject({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spreadsheetUrl:
              "https://docs.google.com/spreadsheets/d/sheet_123/edit",
            selectedSheetIds: [1],
            headerSelections: [
              { sheetId: 1, mode: "auto", startRow: 3, endRow: 3 },
            ],
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

      if (url.endsWith("/google-sheets/header-preview")) {
        expect(init).toMatchObject({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spreadsheetUrl:
              "https://docs.google.com/spreadsheets/d/sheet_123/edit",
            sheetId: 1,
          }),
        });
        return Response.json({
          preview: {
            sheetId: 1,
            sheetTitle: "Alpha",
            inspectedRowCount: 5,
            candidates: [
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
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        initialResources={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    fireEvent.change(screen.getByLabelText("Google Sheet link"), {
      target: {
        value: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check access" }));

    expect(await screen.findByText("Access confirmed")).toBeTruthy();
    expect(screen.getByText("Choose tabs from Mission Sheet")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Alpha"));
    expect(
      await screen.findByLabelText("Header row for Alpha"),
    ).toBeTruthy();
    expect(screen.getByText("People Group")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Dataset classification"), {
      target: { value: "PGIC" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect selected tabs" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/dashboard/api-connections/99999999-9999-4999-8999-999999999999",
      );
    });
  });

  it("copies the app service account email from the Google Sheets card", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        initialResources={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy app email" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(serviceAccountEmail);
    });
  });

  it("keeps the pasted URL and tells admins to share as Viewer when access is denied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { error: "Google Sheet is not shared with the service account." },
          { status: 403 },
        ),
      ),
    );

    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        initialResources={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    fireEvent.change(screen.getByLabelText("Google Sheet link"), {
      target: {
        value: "https://docs.google.com/spreadsheets/d/private_sheet/edit",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check access" }));

    expect(await screen.findByText("Google Sheets access failed")).toBeTruthy();
    expect(
      screen.getByText("Google Sheet is not shared with the service account."),
    ).toBeTruthy();
    expect(
      screen.getByText((content) =>
        content.includes(`${serviceAccountEmail} as Viewer`),
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Google Sheet link")).toHaveProperty(
      "value",
      "https://docs.google.com/spreadsheets/d/private_sheet/edit",
    );
  });

  it("disables Google Sheets checks when service-account email is missing", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        initialResources={[]}
        serviceAccountEmail={null}
      />,
    );

    expect(screen.getByText("Not configured")).toBeTruthy();
    expect(
      screen.getByText(
        "Google Sheets service-account access is not configured",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy app email" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Check access" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("renders the service-account setup without legacy redirect controls", () => {
    render(
      <ApiConnectionsClient
        initialConnections={[]}
        initialRuns={[]}
        initialResources={[]}
        serviceAccountEmail={serviceAccountEmail}
      />,
    );

    expect(screen.getByText("Share with app email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check access" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("renders captured resources as label-only read-only rows", () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ApiConnectionsClient
        initialConnections={[pgicConnection]}
        initialRuns={[queuedRun]}
        initialResources={[resource, resourceWithoutDisplayText]}
        serviceAccountEmail={serviceAccountEmail}
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
